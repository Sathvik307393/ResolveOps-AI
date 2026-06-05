from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
from rag.rag_engine import LogRageEngine
from typing import Optional, List
import jwt
import datetime
import hashlib
from passlib.context import CryptContext
import uuid
import boto3
from boto3.dynamodb.conditions import Key

from database import init_dynamodb, get_users_table, get_keys_table, get_incidents_table, get_logs_table
import notifications

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

class ChatRequest(BaseModel):
    query: str
    time_window_mins: Optional[int] = 30

class ChatResponse(BaseModel):
    answer: str
    citations: list

class ApiKeyResponse(BaseModel):
    key: str
    name: str

# --- Auth Endpoints (DynamoDB) ---
@app.post("/register")
def register_user(user: UserAuth):
    try:
        users_table = get_users_table()
        
        # Check if user exists
        response = users_table.get_item(Key={'email': user.email})
        if 'Item' in response:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        user_id = str(uuid.uuid4())
        
        # Save user
        users_table.put_item(Item={
            'email': user.email,
            'user_id': user_id,
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

@app.post("/login")
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
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(verify_api_key)):
    try:
        # result = engine.run_query(request.query, request.time_window_mins, current_user['user_id'])
        result = engine.run_query(request.query, request.time_window_mins)
        return ChatResponse(
            answer=result.get("answer", ""),
            citations=result.get("citations", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Telemetry Ingress ---
class NexusEvent(BaseModel):
    service: str
    level: str
    message: str
    latency_ms: Optional[float] = None
    status_code: Optional[int] = None
    request_id: Optional[str] = None

@app.post("/api/v1/ingest")
def ingest_telemetry(event: NexusEvent, current_user: dict = Depends(verify_api_key)):
    try:
        tenant_id = current_user.get("user_id") # Map API key to tenant/user
        logs_table = get_logs_table()
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        logs_table.put_item(Item={
            'tenant_id': tenant_id,
            'timestamp': timestamp,
            'service': event.service,
            'level': event.level,
            'message': event.message,
            'latency_ms': str(event.latency_ms) if event.latency_ms else None,
            'status_code': event.status_code,
            'request_id': event.request_id
        })
        
        # Super simple mock incident trigger for "ERROR" severity
        if event.level.upper() in ["ERROR", "CRITICAL", "FATAL"]:
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
                tenant_email=current_user.get("email"),
                incident_id=incident_id,
                service=event.service,
                severity=event.level.upper()
            )
            
        return {"status": "success", "message": "Log ingested"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest Error: {str(e)}")

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

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
