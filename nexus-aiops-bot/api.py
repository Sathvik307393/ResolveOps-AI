from fastapi import FastAPI, HTTPException, Depends, Security, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
from rag.rag_engine import LogRageEngine
from typing import Optional, List, Dict
import jwt
import datetime
import hashlib
import random
import time
from passlib.context import CryptContext
import uuid
import boto3
from boto3.dynamodb.conditions import Key
import requests

from database import (
    init_dynamodb, get_users_table, get_keys_table, get_incidents_table, get_logs_table,
    get_deployments_table, store_log, get_logs, update_reliability_score, get_reliability_score, store_deployment, get_latest_deployment,
    store_chat_message, get_chat_history, get_predictive_risks,
    update_user_integrations, get_user_integrations
)
import notifications
from predictive_engine import PredictiveEngine

# Initialize Predictive Engine
predictive_engine = PredictiveEngine()

# Initialize tables if they don't exist
try:
    init_dynamodb()
except Exception as e:
    print("Warning: Could not initialize DynamoDB tables (are AWS credentials set?):", e)

app = FastAPI(
    title="NexusAI SaaS API",
    description="Multi-tenant SaaS API with DynamoDB Backend",
    version="3.0.0"
)

engine = LogRageEngine()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

JWT_SECRET = "super_secret_jwt_key_for_nexus_saas"

def get_password_hash(password: str) -> str:
    # Use pure SHA-256 to absolutely guarantee no passlib 72-byte length crashes
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode('utf-8')).hexdigest() == hashed_password

# --- Models ---
class UserAuth(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    otp_code: Optional[str] = None

class OTPRequest(BaseModel):
    email: str
    full_name: str

# In-memory OTP store: {email: {"otp": "123456", "full_name": "John", "expires": timestamp}}
otp_store: dict = {}

class ChatRequest(BaseModel):
    message: str
    image_base64: Optional[str] = None
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    session_id: str

class ApiKeyResponse(BaseModel):
    key: str
    name: str

# --- OTP Endpoint ---
@app.post("/api/request-otp")
def request_otp(req: OTPRequest):
    """Generate and email a 6-digit OTP for email verification."""
    # Check if email already registered
    users_table = get_users_table()
    existing = users_table.get_item(Key={'email': req.email})
    if 'Item' in existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    otp_code = str(random.randint(100000, 999999))
    otp_store[req.email] = {
        "otp": otp_code,
        "full_name": req.full_name,
        "expires": time.time() + 120  # 2-minute TTL
    }

    # Send OTP email
    notifications.send_otp_email(
        email=req.email,
        full_name=req.full_name,
        otp_code=otp_code
    )
    return {"message": f"OTP sent to {req.email}. Please check your inbox."}

# --- Auth Endpoints (DynamoDB) ---
@app.post("/api/register")
def register_user(user: UserAuth):
    try:
        # Validate OTP first
        if not user.otp_code:
            raise HTTPException(status_code=400, detail="OTP code is required")

        stored = otp_store.get(user.email)
        if not stored:
            raise HTTPException(status_code=400, detail="No OTP found for this email. Please request one first.")
        if time.time() > stored["expires"]:
            del otp_store[user.email]
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
        if stored["otp"] != user.otp_code:
            raise HTTPException(status_code=400, detail="Invalid OTP code.")

        full_name = user.full_name or stored.get("full_name", "")
        # Clear OTP after successful validation
        del otp_store[user.email]

        users_table = get_users_table()
        
        # Check if user exists
        response = users_table.get_item(Key={'email': user.email})
        if 'Item' in response:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        user_id = str(uuid.uuid4())

        # Save user with full_name
        users_table.put_item(Item={
            'email': user.email,
            'user_id': user_id,
            'full_name': full_name,
            'hashed_password': hashed_password,
            'created_at': datetime.datetime.utcnow().isoformat()
        })
        
        # Generate default API key
        keys_table = get_keys_table()
        default_key = "nx_live_" + str(uuid.uuid4()).replace("-", "")
        keys_table.put_item(Item={
            'api_key': default_key,
            'user_id': user_id,
            'email': user.email,
            'name': "Default Integration Key",
            'is_active': True,
            'created_at': datetime.datetime.utcnow().isoformat()
        })
        
        return {"message": "User registered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@app.post("/api/login")
def login_user(user: UserAuth):
    try:
        users_table = get_users_table()
        response = users_table.get_item(Key={'email': user.email})
        
        if 'Item' not in response:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        db_user = response['Item']
        if not verify_password(user.password, db_user['hashed_password']):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        token = jwt.encode({
            "user_id": db_user['user_id'],
            "email": db_user['email'],
            "full_name": db_user.get('full_name', ''),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, JWT_SECRET, algorithm="HS256")
        
        return {"token": token}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

# --- Protected API Key Endpoints (DynamoDB) ---
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload  # Contains user_id and email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/keys", response_model=List[ApiKeyResponse])
def get_api_keys(current_user: dict = Depends(get_current_user)):
    keys_table = get_keys_table()
    user_id = current_user.get("user_id")
    
    response = keys_table.query(
        IndexName='UserIdIndex',
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    
    keys = response.get('Items', [])
    return [{"key": k['api_key'], "name": k.get('name', 'Key')} for k in keys if k.get('is_active', True)]

@app.post("/api/keys/generate", response_model=ApiKeyResponse)
def generate_api_key(current_user: dict = Depends(get_current_user)):
    keys_table = get_keys_table()
    new_key_str = "nx_live_" + str(uuid.uuid4()).replace("-", "")
    key_name = f"Key {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    keys_table.put_item(Item={
        'api_key': new_key_str,
        'user_id': current_user.get("user_id"),
        'email': current_user.get("email"),
        'name': key_name,
        'is_active': True,
        'created_at': datetime.datetime.utcnow().isoformat()
    })
    
    return {"key": new_key_str, "name": key_name}

# --- Core Bot Endpoint (Secured via API Key in DynamoDB) ---
def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    api_key = credentials.credentials
    keys_table = get_keys_table()
    
    response = keys_table.get_item(Key={'api_key': api_key})
    if 'Item' not in response or not response['Item'].get('is_active', True):
        raise HTTPException(status_code=401, detail="Invalid or revoked API Key")
        
    return response['Item']

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        tenant_email = current_user.get("email")
        session_id = request.session_id if request.session_id else str(uuid.uuid4())
        
        # 1. Store User Message
        store_chat_message(
            tenant_id=tenant_id,
            session_id=session_id,
            role="user",
            content=request.message,
            image_base64=request.image_base64
        )
        
        # 2. Fetch cloud logs if any
        cloud_logs = get_cloud_logs(current_user)
        cloud_logs_str = None
        if cloud_logs:
            cloud_logs_str = "\n".join([f"[{l['timestamp']}] {l['resource_id']} - {l['level']}: {l['message']}" for l in cloud_logs])
            
        result = engine.run_query(
            query=request.message,
            time_window_mins=30,
            image_base64=request.image_base64,
            cloud_logs_str=cloud_logs_str,
            tenant_email=tenant_email
        )
        
        answer = result.get("answer", "")
        
        # Save assistant response to history
        store_chat_message(
            tenant_id=tenant_id,
            session_id=session_id,
            role="assistant",
            content=answer
        )
        
        return ChatResponse(
            answer=answer,
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/history")
def get_chat_history_endpoint(session_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        return get_chat_history(tenant_id, session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions")
def get_chat_sessions_endpoint(current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        return get_chat_sessions(tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chat/history")
def delete_chat_history_endpoint(session_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        delete_chat_history(tenant_id, session_id=session_id)
        return {"status": "success", "message": "Chat history deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VoiceRequest(BaseModel):
    audio_base64: str

@app.post("/api/chat/voice")
async def chat_voice_endpoint(request: VoiceRequest, current_user: dict = Depends(get_current_user)):
    try:
        import speech_recognition as sr
        import base64
        import tempfile
        import os
        import subprocess

        # Decode base64
        audio_data = base64.b64decode(request.audio_base64)
        
        # Write to temp file (could be webm)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_in:
            temp_in.write(audio_data)
            temp_in_path = temp_in.name
            
        temp_out_path = temp_in_path.replace(".webm", ".wav")
        
        # Use ffmpeg to convert to wav (SpeechRecognition requires WAV)
        try:
            subprocess.run(["ffmpeg", "-y", "-i", temp_in_path, temp_out_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            # Fallback if ffmpeg isn't installed: try reading directly (works if browser sent WAV natively)
            import shutil
            shutil.copy(temp_in_path, temp_out_path)

        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_out_path) as source:
            audio = recognizer.record(source)
            
        text = recognizer.recognize_google(audio)
        
        # Cleanup
        try:
            os.remove(temp_in_path)
            os.remove(temp_out_path)
        except:
            pass
            
        return {"text": text}
    except sr.UnknownValueError:
        raise HTTPException(status_code=400, detail="Could not understand audio")
    except sr.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition service error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Removed in-memory SaaS Connection store in favor of DynamoDB get_user_integrations

def fetch_latest_github_deployment(tenant_email: str) -> Optional[dict]:
    """Fetches the latest commit from the tenant's most recently updated repository using their PAT."""
    try:
        tenant_data = get_user_integrations(tenant_email)
        if not tenant_data.get("github") or not tenant_data["github"].get("connected"):
            return None # GitHub not connected
            
        pat = tenant_data["github"].get("credentials", {}).get("github_token")
        if not pat:
            return None
            
        headers = {
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # 1. Fetch most recently updated repo
        repos_url = "https://api.github.com/user/repos?sort=updated&per_page=1"
        repos_res = requests.get(repos_url, headers=headers)
        if repos_res.status_code != 200:
            print(f"Failed to fetch repos: {repos_res.text}")
            return None
            
        repos = repos_res.json()
        if not repos:
            return None
            
        latest_repo = repos[0]
        repo_full_name = latest_repo["full_name"]
        
        # 2. Fetch latest commit from this repo
        commits_url = f"https://api.github.com/repos/{repo_full_name}/commits?per_page=1"
        commits_res = requests.get(commits_url, headers=headers)
        if commits_res.status_code != 200:
            print(f"Failed to fetch commits: {commits_res.text}")
            return None
            
        commits = commits_res.json()
        if not commits:
            return None
            
        latest_commit = commits[0]
        
        return {
            "commit_sha": latest_commit["sha"],
            "commit_msg": latest_commit["commit"]["message"],
            "author": latest_commit["commit"]["author"]["name"],
            "repository": repo_full_name,
            "timestamp": latest_commit["commit"]["author"]["date"],
            "pr_url": latest_commit["html_url"] # link to commit
        }
    except Exception as e:
        print(f"Error fetching github deployment: {e}")
        return None

# --- Telemetry Ingress Models ---
class UniversalEvent(BaseModel):
    provider: str
    resource_type: str
    resource_name: str
    level: str
    message: str
    payload: Optional[dict] = None

class PromGrafanaEvent(BaseModel):
    alert_name: str
    status: str
    labels: dict
    annotations: dict

class NexusEvent(BaseModel):
    service: str
    level: str
    message: str
    latency_ms: Optional[float] = None
    status_code: Optional[int] = None
    request_id: Optional[str] = None
    cluster_id: Optional[str] = None
    resource_id: Optional[str] = None

class GitHubDeploymentEvent(BaseModel):
    commit_sha: str
    commit_msg: str
    author: str
    repository: str
    workflow_run_id: Optional[str] = None
    pr_url: Optional[str] = None

@app.post("/api/v1/github/webhook")
def github_webhook(event: GitHubDeploymentEvent, current_user: dict = Depends(get_current_user)):
    """Receives GitHub Deployment and Workflow Run details for telemetry correlation."""
    try:
        tenant_id = current_user.get("user_id")
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        success = store_deployment(
            tenant_id=tenant_id,
            timestamp=timestamp,
            deploy_data={
                "commit_sha": event.commit_sha,
                "commit_msg": event.commit_msg,
                "author": event.author,
                "repository": event.repository,
                "workflow_run_id": event.workflow_run_id,
                "pr_url": event.pr_url
            }
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to store deployment correlation context")

        # Ingest a system log indicating a deployment occurred
        store_log(
            tenant_id=tenant_id,
            timestamp=timestamp,
            log_data={
                "service": "github-actions",
                "level": "INFO",
                "message": f"Deployment Completed: {event.repository} (Commit: {event.commit_sha[:7]} by {event.author})",
                "cluster_id": "github",
                "resource_id": event.workflow_run_id
            }
        )
        return {"status": "success", "message": "GitHub deployment recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ingest")
def ingest_telemetry(event: NexusEvent, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        tenant_email = current_user.get("email")
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        # Abstraction Layer Log Write (Future proofed repository pattern)
        store_log(
            tenant_id=tenant_id,
            timestamp=timestamp,
            log_data={
                "service": event.service,
                "level": event.level,
                "message": event.message,
                "latency_ms": event.latency_ms,
                "status_code": event.status_code,
                "request_id": event.request_id,
                "cluster_id": event.cluster_id,
                "resource_id": event.resource_id
            }
        )
        
        is_reactive = event.level.upper() in ["ERROR", "CRITICAL", "FATAL"]

        if is_reactive:
            # --- 1. Reactive Pipeline ---
            # Update Reliability Score (Deduct 5.0 points)
            current_score = get_reliability_score(tenant_email)
            update_reliability_score(tenant_email, current_score - 5.0)

            incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
            incidents_table = get_incidents_table()
            incidents_table.put_item(Item={
                'tenant_id': tenant_id,
                'incident_id': incident_id,
                'status': 'OPEN',
                'severity': event.level.upper(),
                'service': event.service,
                'created_at': timestamp,
                'rca_report': ''
            })
            
            # Dispatch email using the Notification Framework
            notifications.notify_incident_created(
                tenant_email=tenant_email,
                incident_id=incident_id,
                service=event.service,
                severity=event.level.upper(),
                full_name=current_user.get("full_name", "")
            )
        else:
            # --- 2. Predictive Pipeline ---
            # Fetch recent logs for analyzing trends
            recent_logs = db_get_logs(tenant_id, limit=50)
            
            # Evaluate using predictive heuristics
            is_anomaly, prediction = predictive_engine.analyze_logs_and_predict(recent_logs)
            if is_anomaly and prediction:
                # Update Reliability Score (Deduct 2.0 points for proactive threat)
                current_score = get_reliability_score(tenant_email)
                update_reliability_score(tenant_email, current_score - 2.0)

                # Correlate with recent GitHub Deployment using PAT
                latest_deploy = fetch_latest_github_deployment(tenant_email)
                if not latest_deploy:
                    # Fallback to webhooks if available
                    latest_deploy = get_latest_deployment(tenant_id)

                # Generate AI-assisted Predictive RCA
                rca_details = predictive_engine.generate_predictive_rca(prediction, latest_deploy)
                
                # Combine predictive alerts & trigger notification
                notifications.notify_predictive_alert(
                    tenant_email=tenant_email,
                    service=prediction["service"],
                    failure_type=prediction["failure_type"],
                    risk_score=prediction["risk_score"],
                    confidence_score=prediction["confidence_score"],
                    probable_cause=rca_details["probable_cause"],
                    suggested_remediation=rca_details["suggested_remediation"],
                    deployment_context=latest_deploy,
                    full_name=current_user.get("full_name", "")
                )
            
        return {"status": "success", "message": "Log ingested and processed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest Error: {str(e)}")

@app.get("/api/v1/reliability")
def get_reliability(current_user: dict = Depends(get_current_user)):
    """Retrieves the current reliability score for the tenant."""
    try:
        tenant_email = current_user.get("email")
        score = get_reliability_score(tenant_email)
        return {"reliability_score": score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/logs")
def get_logs(current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        logs_table = get_logs_table()
        
        response = logs_table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id),
            ScanIndexForward=False, # Get newest first
            Limit=50
        )
        return response.get('Items', [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/telemetry/universal")
def ingest_universal_telemetry(event: UniversalEvent, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        store_log(
            tenant_id=tenant_id,
            timestamp=timestamp,
            log_data={
                "provider": event.provider,
                "resource_type": event.resource_type,
                "service": event.resource_name,
                "level": event.level,
                "message": event.message
            }
        )
        return {"status": "success", "message": "Universal telemetry ingested"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/integrations/prom-grafana")
def ingest_prom_grafana(event: PromGrafanaEvent, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        level = "ERROR" if event.status == "firing" else "INFO"
        
        store_log(
            tenant_id=tenant_id,
            timestamp=timestamp,
            log_data={
                "provider": "observability",
                "resource_type": "prometheus",
                "service": event.labels.get("service", "unknown"),
                "level": level,
                "message": event.annotations.get("description", event.alert_name)
            }
        )
        return {"status": "success", "message": "Prometheus/Grafana alert processed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/incidents/predictive")
def get_predictive_incidents(current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        risks = get_predictive_risks(tenant_id)
        return risks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Incident Management ---
@app.get("/api/v1/incidents")
def get_incidents(current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        incidents_table = get_incidents_table()
        
        response = incidents_table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id)
        )
        return response.get('Items', [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/incidents/{incident_id}/rca")
def generate_incident_rca(incident_id: str, current_user: dict = Depends(get_current_user)):
    try:
        tenant_id = current_user.get("user_id")
        incidents_table = get_incidents_table()
        
        # Verify incident belongs to tenant
        response = incidents_table.get_item(Key={'tenant_id': tenant_id, 'incident_id': incident_id})
        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Incident not found")
            
        incident = response['Item']
        
        # Trigger actual RCA generation (using the RAG engine)
        rca_query = f"Generate a Root Cause Analysis for incident {incident_id} affecting {incident.get('service')}. Look for recent errors in the logs."
        rca_result = engine.run_query(rca_query, time_window_mins=60)
        rca_report = rca_result.get("answer", "No RCA could be generated.")
        
        # Update Database
        incidents_table.update_item(
            Key={'tenant_id': tenant_id, 'incident_id': incident_id},
            UpdateExpression="SET rca_report = :rca, #st = :st",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":rca": rca_report, ":st": "ANALYZED"}
        )
        
        # Send RCA Email
        notifications.notify_rca_completed(
            tenant_email=current_user.get("email"),
            incident_id=incident_id,
            service=incident.get("service"),
            rca_report=rca_report
        )
        
        return {"status": "success", "incident_id": incident_id, "rca_report": rca_report}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

github_deployments_cache = {}
github_repo_workflow_cache = {}
notified_failed_workflows = set()

def auto_diagnose_and_notify_pipeline(current_user: dict, pat: str, repo_name: str, workflow_run_id: str):
    """Background task to diagnose pipeline failure and send email."""
    try:
        headers = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github.v3+json"}
        jobs_url = f"https://api.github.com/repos/{repo_name}/actions/runs/{workflow_run_id}/jobs"
        jobs_res = requests.get(jobs_url, headers=headers)
        if jobs_res.status_code != 200: return
            
        jobs = jobs_res.json().get("jobs", [])
        failed_job = next((job for job in jobs if job.get("conclusion") == "failure"), None)
        if not failed_job: return
            
        job_id = failed_job["id"]
        logs_url = f"https://api.github.com/repos/{repo_name}/actions/jobs/{job_id}/logs"
        logs_res = requests.get(logs_url, headers=headers)
        if logs_res.status_code != 200: return
            
        raw_logs = logs_res.text
        log_snippet = raw_logs[-3000:]
        diagnosis_query = f"The GitHub Actions pipeline '{failed_job['name']}' in repository '{repo_name}' failed. Analyze these logs and predict the exact root cause and an accurate solution:\n\n{log_snippet}"
        
        ai_result = engine.run_query(diagnosis_query, time_window_mins=60)
        diagnosis = ai_result.get("answer", "Analysis failed.")
        
        # Send Email
        notifications.notify_pipeline_failure(
            tenant_email=current_user.get("email"),
            repository=repo_name,
            job_name=failed_job["name"],
            raw_logs=log_snippet,
            ai_diagnosis=diagnosis,
            full_name=current_user.get("full_name", "")
        )
    except Exception as e:
        print(f"Background diagnostic error: {e}")


@app.get("/api/v1/github/deployments")
def get_github_deployments(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Retrieves deployment logs for the authenticated tenant."""
    try:
        tenant_id = current_user.get("user_id")
        
        # Check cache
        current_time = time.time()
        cache_key = f"github_deployments_{tenant_id}"
        if cache_key in github_deployments_cache:
            cache_entry = github_deployments_cache[cache_key]
            if current_time - cache_entry['time'] < 10:  # 10 second TTL
                return cache_entry['data']

        table = get_deployments_table()
        response = table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id),
            ScanIndexForward=False,
            Limit=50
        )
        db_items = response.get('Items', [])
        
        # Merge live deployments from PAT if available
        tenant_data = get_user_integrations(current_user.get("email"))
        pat = tenant_data.get("github", {}).get("credentials", {}).get("github_token")
        
        if pat:
            headers = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github.v3+json"}
            repos = []
            
            # 1. All accessible repositories
            owner_res = requests.get("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member", headers=headers, timeout=5)
            if owner_res.status_code == 200:
                repos.extend(owner_res.json())
                
            if repos:
                import concurrent.futures

                def fetch_repo_data(repo):
                    repo_name = repo.get("full_name")
                    if not repo_name: return None
                    repo_updated_at = repo.get("updated_at", "")
                    cache_key_repo = f"{tenant_id}_{repo_name}"
                    
                    # Check smart per-repo cache
                    if cache_key_repo in github_repo_workflow_cache:
                        cached_entry = github_repo_workflow_cache[cache_key_repo]
                        if cached_entry["updated_at"] == repo_updated_at:
                            return cached_entry["db_items"]

                    repo_items = []
                    try:
                        runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?per_page=15"
                        runs_res = requests.get(runs_url, headers=headers, timeout=3)
                        if runs_res.status_code == 200:
                            runs_data = runs_res.json()
                            runs = runs_data.get("workflow_runs", [])
                            
                            if runs:
                                run = runs[0]
                                repo_items.append({
                                    "commit_sha": run.get("head_sha", ""),
                                    "commit_msg": (run.get("head_commit") or {}).get("message", "Commit"),
                                    "author": ((run.get("head_commit") or {}).get("author") or {}).get("name", "Unknown"),
                                    "repository": repo_name,
                                    "workflow_name": run.get("name", "Pipeline"),
                                    "timestamp": run.get("updated_at") or run.get("created_at") or "",
                                    "workflow_run_id": str(run.get("id", "")),
                                    "status": run.get("status"),
                                    "conclusion": run.get("conclusion")
                                })
                            
                            if not repo_items:
                                # Fallback to commit if no workflow runs exist
                                commits_url = f"https://api.github.com/repos/{repo_name}/commits?per_page=1"
                                commits_res = requests.get(commits_url, headers=headers, timeout=3)
                                if commits_res.status_code == 200:
                                    commits = commits_res.json()
                                    if commits and isinstance(commits, list) and len(commits) > 0:
                                        commit = commits[0]
                                        repo_items.append({
                                            "commit_sha": commit.get("sha", ""),
                                            "commit_msg": (commit.get("commit") or {}).get("message", "Commit"),
                                            "author": ((commit.get("commit") or {}).get("author") or {}).get("name", "Unknown"),
                                            "repository": repo_name,
                                            "workflow_name": "Source Sync",
                                            "timestamp": ((commit.get("commit") or {}).get("author") or {}).get("date", ""),
                                            "workflow_run_id": "PAT_SYNC",
                                            "status": "completed",
                                            "conclusion": "success"
                                        })
                    except requests.exceptions.RequestException:
                        pass
                    
                    if not repo_items:
                        repo_items.append({
                            "commit_sha": "N/A",
                            "commit_msg": "No pipeline data or repository is empty.",
                            "author": "-",
                            "repository": repo_name,
                            "workflow_name": "No Pipelines",
                            "timestamp": repo_updated_at,
                            "workflow_run_id": "PAT_SYNC",
                            "status": "completed",
                            "conclusion": "success"
                        })
                    
                    github_repo_workflow_cache[cache_key_repo] = {
                        "updated_at": repo_updated_at,
                        "db_items": repo_items
                    }
                    return repo_items

                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                    results = executor.map(fetch_repo_data, repos)
                    for items in results:
                        if items:
                            for item in items:
                                db_items.append(item)
                                
                                # Trigger background diagnosis if pipeline failed and hasn't been notified yet
                                if item.get("conclusion") == "failure" and item.get("workflow_run_id") != "PAT_SYNC":
                                    run_id = item.get("workflow_run_id")
                                    if run_id not in notified_failed_workflows:
                                        notified_failed_workflows.add(run_id)
                                        background_tasks.add_task(
                                            auto_diagnose_and_notify_pipeline, 
                                            current_user, 
                                            pat, 
                                            item.get("repository"), 
                                            run_id
                                        )
                            
        # Sort combined items by timestamp descending
        db_items.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        
        # Save to main 10s cache
        github_deployments_cache[cache_key] = {'time': current_time, 'data': db_items}
        
        return db_items
    except Exception as e:
        import traceback
        with open("error.log", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

class DiagnoseRequest(BaseModel):
    repository: str
    workflow_run_id: str

@app.post("/api/v1/github/diagnose")
def diagnose_github_pipeline(req: DiagnoseRequest, current_user: dict = Depends(get_current_user)):
    """Fetches failed workflow logs and generates an AI diagnosis."""
    try:
        tenant_email = current_user.get("email")
        tenant_data = get_user_integrations(tenant_email)
        pat = tenant_data.get("github", {}).get("credentials", {}).get("github_token")
        
        if not pat:
            raise HTTPException(status_code=400, detail="GitHub PAT not found")
            
        headers = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github.v3+json"}
        
        # 1. Get Jobs for the Workflow Run
        jobs_url = f"https://api.github.com/repos/{req.repository}/actions/runs/{req.workflow_run_id}/jobs"
        jobs_res = requests.get(jobs_url, headers=headers)
        if jobs_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch jobs for workflow")
            
        jobs = jobs_res.json().get("jobs", [])
        failed_job = next((job for job in jobs if job.get("conclusion") == "failure"), None)
        
        if not failed_job:
            return {"diagnosis": "No failed jobs found in this workflow run."}
            
        job_id = failed_job["id"]
        
        # 2. Get Logs for the failed Job
        logs_url = f"https://api.github.com/repos/{req.repository}/actions/jobs/{job_id}/logs"
        logs_res = requests.get(logs_url, headers=headers)
        
        if logs_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download job logs. Ensure PAT has 'actions:read' permission.")
            
        raw_logs = logs_res.text
        
        # 3. Analyze Logs with RAG Engine
        # Limit logs to last 3000 chars to avoid token limits
        log_snippet = raw_logs[-3000:]
        
        diagnosis_query = f"The GitHub Actions pipeline '{failed_job['name']}' in repository '{req.repository}' failed. Analyze these logs and predict the exact root cause and an accurate solution:\n\n{log_snippet}"
        
        ai_result = engine.run_query(diagnosis_query, time_window_mins=60)
        diagnosis = ai_result.get("answer", "Analysis failed.")
        
        return {
            "status": "success",
            "job_name": failed_job["name"],
            "diagnosis": diagnosis,
            "raw_logs": log_snippet
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RunWorkflowRequest(BaseModel):
    repository: str
    workflow_id: str
    branch: str = "main"

@app.post("/api/v1/github/workflows/run")
def run_github_workflow(req: RunWorkflowRequest, current_user: dict = Depends(get_current_user)):
    """Triggers a GitHub Actions workflow manually."""
    try:
        tenant_email = current_user.get("email")
        tenant_data = get_user_integrations(tenant_email)
        pat = tenant_data.get("github", {}).get("credentials", {}).get("github_token")
        
        if not pat:
            raise HTTPException(status_code=400, detail="GitHub PAT not found")
            
        headers = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github.v3+json"}
        
        # Trigger workflow dispatch or rerun
        if req.workflow_id.isdigit():
            # Attempt to rerun existing workflow run
            dispatch_url = f"https://api.github.com/repos/{req.repository}/actions/runs/{req.workflow_id}/rerun"
            r = requests.post(dispatch_url, headers=headers)
            
            # If rerun fails (e.g., >30 days old, or successful run), fallback to dispatching a new run
            if r.status_code not in [204, 201]:
                run_info = requests.get(f"https://api.github.com/repos/{req.repository}/actions/runs/{req.workflow_id}", headers=headers)
                if run_info.status_code == 200:
                    real_workflow_id = run_info.json().get("workflow_id")
                    if real_workflow_id:
                        dispatch_url = f"https://api.github.com/repos/{req.repository}/actions/workflows/{real_workflow_id}/dispatches"
                        payload = {"ref": req.branch}
                        r = requests.post(dispatch_url, headers=headers, json=payload)
        else:
            dispatch_url = f"https://api.github.com/repos/{req.repository}/actions/workflows/{req.workflow_id}/dispatches"
            payload = {"ref": req.branch}
            r = requests.post(dispatch_url, headers=headers, json=payload)
            
        if r.status_code not in [204, 201]:
            raise HTTPException(status_code=400, detail=f"Failed to trigger workflow: {r.text}")
            
        return {"status": "success", "message": f"Successfully triggered workflow in {req.repository}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/k8s/resources")
def get_k8s_resources(current_user: dict = Depends(get_current_user)):
    """Returns cluster nodes, active pods, and deployment states for AKS/EKS dashboard visualization."""
    try:
        # Mock telemetry matching Kubernetes schema specifications
        return {
            "cluster_id": "aks-prod-cluster-01",
            "provider": "Azure Kubernetes Service",
            "region": "us-east-1",
            "nodes": [
                {"name": "aks-nodepool1-vm-0", "status": "Ready", "cpu_util": "48%", "mem_util": "62%"},
                {"name": "aks-nodepool1-vm-1", "status": "Ready", "cpu_util": "35%", "mem_util": "50%"},
                {"name": "aks-nodepool1-vm-2", "status": "Ready", "cpu_util": "72%", "mem_util": "85%"}
            ],
            "pods": [
                {"name": "payment-api-cf7d685-z8a9s", "namespace": "production", "status": "Running", "restarts": 0, "cpu": "120m", "mem": "240Mi"},
                {"name": "auth-service-5421c9b-h2n3s", "namespace": "production", "status": "Running", "restarts": 2, "cpu": "80m", "mem": "150Mi"},
                {"name": "log-collector-flb-8h1n2", "namespace": "kube-system", "status": "Running", "restarts": 0, "cpu": "50m", "mem": "95Mi"},
                {"name": "notification-worker-6b998-f2nsd", "namespace": "production", "status": "Running", "restarts": 1, "cpu": "110m", "mem": "180Mi"}
            ],
            "deployments": [
                {"name": "payment-api", "desired": 3, "ready": 3, "updated": 3},
                {"name": "auth-service", "desired": 2, "ready": 2, "updated": 2},
                {"name": "notification-worker", "desired": 2, "ready": 2, "updated": 2}
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/metrics")
def get_service_metrics(current_user: dict = Depends(get_current_user)):
    """Compiles service-specific telemetry indicators."""
    try:
        tenant_id = current_user.get("user_id")
        logs = db_get_logs(tenant_id, limit=100)
        
        # Aggregate heuristics per service
        metrics = {}
        for log in logs:
            srv = log.get("service", "unknown")
            if srv not in metrics:
                metrics[srv] = {"latency_sum": 0.0, "latency_count": 0, "warnings": 0, "errors": 0}
            
            lvl = log.get("level", "INFO").upper()
            if lvl == "WARN":
                metrics[srv]["warnings"] += 1
            elif lvl in ("ERROR", "CRITICAL", "FATAL"):
                metrics[srv]["errors"] += 1
                
            lat = log.get("latency_ms")
            if lat:
                metrics[srv]["latency_sum"] += float(lat)
                metrics[srv]["latency_count"] += 1
                
        results = []
        for srv, stats in metrics.items():
            avg_lat = stats["latency_sum"] / stats["latency_count"] if stats["latency_count"] > 0 else 0.0
            results.append({
                "service": srv,
                "avg_latency": round(avg_lat, 2),
                "warnings": stats["warnings"],
                "errors": stats["errors"],
                "health_score": max(0, 100 - (stats["errors"] * 10 + stats["warnings"] * 3))
            })
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Removed In-memory SaaS Connection store in favor of DynamoDB

class ConnectionRequest(BaseModel):
    service: str # "github", "eks", or "aks"
    connected: bool
    credentials: Optional[dict] = None

@app.get("/api/v1/integrations")
def get_integrations(current_user: dict = Depends(get_current_user)):
    """Retrieves external integration statuses for this tenant workspace."""
    try:
        tenant_email = current_user.get("email")
        integrations = get_user_integrations(tenant_email)
        
        status_map = {
            "github": False, "aws": False, "azure": False,
            "github_details": None
        }
        for k in list(status_map.keys()):
            if k == "github_details": continue
            if k in integrations and integrations[k].get("connected"):
                status_map[k] = True
                if k == "github":
                    status_map["github_details"] = integrations[k].get("credentials", {}).get("github_username")
                
        return status_map
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/integrations/connect")
def update_integration_connection(req: ConnectionRequest, current_user: dict = Depends(get_current_user)):
    """Updates / Saves credentials and toggles connection status for an external service."""
    import requests
    try:
        tenant_email = current_user.get("email")
        integrations = get_user_integrations(tenant_email)
        
        service_key = req.service.lower()
        if service_key not in integrations:
            integrations[service_key] = {}
            
        if req.connected and service_key == "github" and req.credentials:
            github_token = req.credentials.get("github_token")
            github_email = req.credentials.get("github_email")
            
            if github_token and github_email:
                headers = {
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Authorization": f"token {github_token}"
                }
                
                # Verify emails
                r_emails = requests.get("https://api.github.com/user/emails", headers=headers, timeout=5)
                if r_emails.status_code != 200:
                    raise HTTPException(status_code=400, detail="Invalid GitHub Personal Access Token or missing 'user:email' scope. Please regenerate your PAT with the 'user:email' scope.")
                
                emails_data = r_emails.json()
                verified_emails = [e.get("email").lower() for e in emails_data if e.get("verified")]
                
                r_user = requests.get("https://api.github.com/user", headers=headers, timeout=5)
                if r_user.status_code != 200:
                    raise HTTPException(status_code=400, detail="Could not determine GitHub account from PAT")
                
                user_data = r_user.json()
                github_login = user_data.get("login")
                
                if github_email.lower() not in verified_emails and github_email.lower() != github_login.lower():
                    raise HTTPException(
                        status_code=400, 
                        detail=f"The provided email/username '{github_email}' does not match the GitHub account associated with this PAT. Verified login is '{github_login}'."
                    )
                
                req.credentials["github_username"] = github_login

        if req.connected and service_key == "azure" and req.credentials:
            from azure.identity import ClientSecretCredential
            from azure.mgmt.subscription import SubscriptionClient
            import azure.core.exceptions

            client_id = req.credentials.get("client_id")
            client_secret = req.credentials.get("client_secret")
            azure_tenant = req.credentials.get("tenant_id")

            if client_id and client_secret and azure_tenant:
                try:
                    credential = ClientSecretCredential(
                        tenant_id=azure_tenant,
                        client_id=client_id,
                        client_secret=client_secret
                    )
                    
                    # Verify by fetching subscriptions
                    sub_client = SubscriptionClient(credential)
                    subs = list(sub_client.subscriptions.list())
                    if not subs:
                        raise HTTPException(status_code=400, detail="Authenticated successfully, but no Azure subscriptions found for this Tenant.")
                except azure.core.exceptions.ClientAuthenticationError as auth_err:
                    raise HTTPException(status_code=400, detail=f"Azure Authentication Failed: {auth_err.message}")
                except Exception as ex:
                    if isinstance(ex, HTTPException):
                        raise ex
                    raise HTTPException(status_code=400, detail=f"Could not verify Azure credentials: {str(ex)}")

        integrations[service_key]["connected"] = req.connected
        if req.credentials:
            integrations[service_key]["credentials"] = req.credentials
            
        update_user_integrations(tenant_email, integrations)
        
        status_map = {
            "github": False, "aws": False, "azure": False,
            "github_details": None
        }
        for k in list(status_map.keys()):
            if k == "github_details": continue
            if k in integrations and integrations[k].get("connected"):
                status_map[k] = True
                if k == "github":
                    status_map["github_details"] = integrations[k].get("credentials", {}).get("github_username")
                
        return {"status": "success", "message": f"{req.service} connection status updated", "integrations": status_map}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import requests

@app.get("/api/v1/github/workflow_status/{owner}/{repo}/{run_id}")
def get_github_workflow_live_status(owner: str, repo: str, run_id: str, current_user: dict = Depends(get_current_user)):
    """Fetches real-time workflow jobs and steps using tenant's stored GitHub credentials."""
    try:
        tenant_email = current_user.get("email")
        integrations = get_user_integrations(tenant_email)
        
        if "github" not in integrations or not integrations["github"].get("connected"):
            raise HTTPException(status_code=400, detail="GitHub integration not connected")
            
        creds = integrations["github"].get("credentials", {})
        github_token = creds.get("github_token")
        
        if not github_token:
            raise HTTPException(status_code=400, detail="GitHub credentials incomplete")
            
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Authorization": f"token {github_token}"
        }
        
        repo_fullname = f"{owner}/{repo}"
        
        # 1. Fetch Run details
        run_url = f"https://api.github.com/repos/{repo_fullname}/actions/runs/{run_id}"
        run_res = requests.get(run_url, headers=headers, timeout=5)
        if run_res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Failed to fetch run from GitHub: {run_res.text}")
        run_data = run_res.json()
        
        # 2. Fetch Jobs
        jobs_url = f"https://api.github.com/repos/{repo_fullname}/actions/runs/{run_id}/jobs"
        jr = requests.get(jobs_url, headers=headers, timeout=5)
        jobs_data = {}
        if jr.status_code == 200:
            jobs_data = jr.json()
            
        jobs = []
        for j in jobs_data.get("jobs", []):
            jobs.append({
                "id": j.get("id"),
                "name": j.get("name"),
                "status": j.get("status"),
                "conclusion": j.get("conclusion"),
                "started_at": j.get("started_at"),
                "completed_at": j.get("completed_at"),
                "html_url": j.get("html_url"),
                "steps": [{"name": s.get("name"), "status": s.get("status"), "conclusion": s.get("conclusion")} for s in j.get("steps", [])]
            })
            
        result = {
            "source": "api",
            "repo": repo_fullname,
            "run_id": run_id,
            "run_number": run_data.get("run_number"),
            "name": run_data.get("name"),
            "status": run_data.get("status"),
            "conclusion": run_data.get("conclusion"),
            "html_url": run_data.get("html_url"),
            "event": run_data.get("event"),
            "head_branch": run_data.get("head_branch"),
            "head_commit_message": run_data.get("head_commit", {}).get("message", "No message"),
            "head_sha": run_data.get("head_sha"),
            "actor": run_data.get("triggering_actor", {}).get("login", run_data.get("actor", {}).get("login", "unknown")),
            "created_at": run_data.get("created_at"),
            "updated_at": run_data.get("updated_at"),
            "jobs": jobs
        }
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CloudSelectRequest(BaseModel):
    selected_ids: List[str]

@app.get("/api/v1/cloud/resources")
def get_cloud_resources(current_user: dict = Depends(get_current_user)):
    """Mocks fetching available cloud resources from connected AWS/Azure accounts."""
    try:
        tenant_email = current_user.get("email")
        integrations = get_user_integrations(tenant_email)
        
        resources = []
        selected_ids = integrations.get("cloud_selections", [])
        
        if integrations.get("aws", {}).get("connected"):
            resources.extend([
                {"id": "aws-ec2-i-0abc1234567890def", "name": "production-api-server", "type": "EC2 Instance", "provider": "AWS", "region": "us-east-1", "status": "running"},
                {"id": "aws-ec2-i-0987654321fedcba0", "name": "worker-node-1", "type": "EC2 Instance", "provider": "AWS", "region": "us-east-1", "status": "running"},
                {"id": "aws-eks-prod-cluster", "name": "eks-prod-cluster", "type": "EKS Cluster", "provider": "AWS", "region": "us-east-1", "status": "active"},
                {"id": "aws-s3-prod-assets", "name": "prod-static-assets", "type": "S3 Bucket", "provider": "AWS", "region": "us-east-1", "status": "active"}
            ])
            
        if integrations.get("azure", {}).get("connected"):
            azure_creds = integrations["azure"].get("credentials", {})
            client_id = azure_creds.get("client_id")
            client_secret = azure_creds.get("client_secret")
            azure_tenant = azure_creds.get("tenant_id")
            
            if client_id and client_secret and azure_tenant:
                try:
                    from azure.identity import ClientSecretCredential
                    from azure.mgmt.subscription import SubscriptionClient
                    from azure.mgmt.resource import ResourceManagementClient
                    
                    credential = ClientSecretCredential(
                        tenant_id=azure_tenant,
                        client_id=client_id,
                        client_secret=client_secret
                    )
                    
                    sub_client = SubscriptionClient(credential)
                    subs = list(sub_client.subscriptions.list())
                    
                    for sub in subs:
                        resource_client = ResourceManagementClient(credential, sub.subscription_id)
                        # Fetch all standard resources
                        all_resources = resource_client.resources.list()
                        for r in all_resources:
                            resources.append({
                                "id": r.id,
                                "name": r.name,
                                "type": r.type.split('/')[-1] if r.type else "Azure Resource",
                                "provider": "Azure",
                                "region": r.location,
                                "status": "active"
                            })
                            
                        # Also fetch resource groups since they act as containers and might be empty
                        resource_groups = resource_client.resource_groups.list()
                        for rg in resource_groups:
                            resources.append({
                                "id": rg.id,
                                "name": rg.name,
                                "type": "Resource Group",
                                "provider": "Azure",
                                "region": rg.location,
                                "status": "active"
                            })
                except Exception as e:
                    print(f"Error fetching Azure resources: {e}")
                    # Fallback or just ignore so it doesn't break AWS or other integrations
            
        for r in resources:
            r["selected"] = r["id"] in selected_ids
            
        return resources
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/cloud/resources/select")
def select_cloud_resources(req: CloudSelectRequest, current_user: dict = Depends(get_current_user)):
    """Saves selected cloud resources to the tenant's integration profile."""
    try:
        tenant_email = current_user.get("email")
        integrations = get_user_integrations(tenant_email)
        integrations["cloud_selections"] = req.selected_ids
        update_user_integrations(tenant_email, integrations)
        return {"status": "success", "message": "Cloud resources selected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/cloud/logs")
def get_cloud_logs(current_user: dict = Depends(get_current_user)):
    """Fetches combined mocked logs for the currently selected cloud resources."""
    try:
        tenant_email = current_user.get("email")
        integrations = get_user_integrations(tenant_email)
        selected_ids = integrations.get("cloud_selections", [])
        
        if not selected_ids:
            return []
            
        # Mock recent logs for the selected resources
        import random
        from datetime import datetime, timedelta
        
        logs = []
        now = datetime.utcnow()
        for idx in range(20):
            res_id = random.choice(selected_ids)
            level = random.choices(["INFO", "WARNING", "ERROR"], weights=[80, 15, 5])[0]
            msg = f"Routine operational trace" if level == "INFO" else f"Memory threshold warning" if level == "WARNING" else f"Connection timed out"
            logs.append({
                "resource_id": res_id,
                "timestamp": (now - timedelta(minutes=random.randint(1, 60))).isoformat() + "Z",
                "level": level,
                "message": f"{msg} for {res_id}"
            })
            
        logs.sort(key=lambda x: x["timestamp"], reverse=True)
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
