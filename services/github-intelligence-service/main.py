from fastapi import FastAPI, HTTPException, Request, Header, BackgroundTasks
import requests
import datetime
import os
import zipfile
import io
from typing import Optional, Dict, List
from pydantic import BaseModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="github-intelligence-service")

# --- Repository Abstraction ---
# In-memory storage for now, designed to be swapped with PostgreSQL/DynamoDB later.
class GitHubDataRepository:
    def __init__(self):
        # Maps token (or derived hash) to user data for isolation.
        # Structure: { "token": { "user": {}, "repos": [], "workflows": [], "runs": [], "last_synced_at": "" } }
        self.store = {}

    def _get_or_create(self, token: str):
        if token not in self.store:
            self.store[token] = {
                "user": {},
                "repos": [],
                "workflows": [],
                "runs": [],
                "last_synced_at": None,
                "warnings": []
            }
        return self.store[token]

    def save_sync_data(self, token: str, user: dict, repos: list, workflows: list, runs: list, warnings: list):
        data = self._get_or_create(token)
        data["user"] = user
        data["repos"] = repos
        data["workflows"] = workflows
        data["runs"] = runs
        data["warnings"] = warnings
        data["last_synced_at"] = datetime.datetime.utcnow().isoformat() + "Z"

    def get_data(self, token: str):
        return self.store.get(token, {})

db = GitHubDataRepository()
# ------------------------------

def get_github_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

def fetch_paginated(url: str, token: str, max_pages: int = 5):
    headers = get_github_headers(token)
    results = []
    page = 1
    while url and page <= max_pages:
        try:
            res = requests.get(url, headers=headers, timeout=15)
            res.raise_for_status()
            data = res.json()
            if isinstance(data, list):
                results.extend(data)
            elif isinstance(data, dict):
                # Sometimes lists are wrapped (like workflows or workflow_runs)
                if "workflows" in data:
                    results.extend(data["workflows"])
                elif "workflow_runs" in data:
                    results.extend(data["workflow_runs"])
            
            # Check for next page
            if "next" in res.links:
                url = res.links["next"]["url"]
                page += 1
            else:
                break
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching {url}: {e}")
            break
    return results

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "github-intelligence-service"}

@app.get("/api/v1/github/status")
def github_status(x_github_token: Optional[str] = Header(None)):
    if not x_github_token:
        raise HTTPException(status_code=401, detail="GitHub PAT is missing")
    
    headers = get_github_headers(x_github_token)
    try:
        res = requests.get("https://api.github.com/user", headers=headers, timeout=10)
        if res.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token is invalid or expired.")
        if res.status_code == 403:
            raise HTTPException(status_code=403, detail="GitHub token does not have required permissions or rate limit exceeded.")
        res.raise_for_status()
        user_data = res.json()
        
        # Check permissions by looking at headers if needed, for now just returning success
        return {
            "status": "connected",
            "username": user_data.get("login"),
            "name": user_data.get("name"),
            "avatar_url": user_data.get("avatar_url")
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"GitHub Status Error: {e}")
        if isinstance(e, requests.exceptions.HTTPError) and e.response.status_code in [401, 403]:
            raise
        raise HTTPException(status_code=500, detail="Error communicating with GitHub API")

@app.post("/api/v1/github/sync")
def sync_github(x_github_token: Optional[str] = Header(None)):
    if not x_github_token:
        raise HTTPException(status_code=401, detail="GitHub PAT is missing")
    
    headers = get_github_headers(x_github_token)
    warnings = []
    
    # 1. Validate & get user
    try:
        user_res = requests.get("https://api.github.com/user", headers=headers, timeout=10)
        if user_res.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token is invalid or expired.")
        user_res.raise_for_status()
        user_data = user_res.json()
        username = user_data.get("login")
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=e.response.status_code, detail="GitHub API error validating token.")

    # 2. Fetch Repositories
    repos = fetch_paginated("https://api.github.com/user/repos?per_page=100", x_github_token)
    
    workflows = []
    runs = []
    
    # 3 & 4. Fetch Workflows and Runs per repo
    for repo in repos:
        repo_full_name = repo.get("full_name")
        owner = repo.get("owner", {}).get("login")
        repo_name = repo.get("name")
        
        # Fetch workflows
        repo_workflows = fetch_paginated(f"https://api.github.com/repos/{owner}/{repo_name}/actions/workflows?per_page=100", x_github_token)
        workflows.extend(repo_workflows)
        
        # Fetch runs (fetch only 1 page per repo to save time/rate limits, or use pagination)
        repo_runs = fetch_paginated(f"https://api.github.com/repos/{owner}/{repo_name}/actions/runs?per_page=50", x_github_token, max_pages=2)
        
        for r in repo_runs:
            runs.append({
                "id": str(r.get("id")),
                "repository": repo_full_name,
                "owner": owner,
                "workflow_name": r.get("name"),
                "workflow_id": str(r.get("workflow_id")),
                "branch": r.get("head_branch"),
                "status": r.get("status"),
                "conclusion": r.get("conclusion") or r.get("status"),
                "event": r.get("event"),
                "run_number": str(r.get("run_number")),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
                "html_url": r.get("html_url"),
                "logs_available": True
            })

    # Save to "DB"
    db.save_sync_data(x_github_token, user_data, repos, workflows, runs, warnings)
    
    failed_runs = sum(1 for r in runs if r["conclusion"] == "failure")
    success_runs = sum(1 for r in runs if r["conclusion"] == "success")
    in_progress = sum(1 for r in runs if r["status"] in ["in_progress", "queued", "pending"])
    
    status_str = "partial_success" if warnings else "success"
    if not repos:
        warnings.append({"message": "No repositories found for this GitHub account."})
        status_str = "partial_success"
    elif not workflows:
        warnings.append({"message": "Repositories found, but no GitHub Actions workflows were detected."})
        status_str = "partial_success"
    elif not runs:
        warnings.append({"message": "Workflows found, but no recent workflow runs were found."})
        status_str = "partial_success"

    return {
        "status": status_str,
        "github_user": username,
        "repositories_count": len(repos),
        "workflows_count": len(workflows),
        "workflow_runs_count": len(runs),
        "failed_runs_count": failed_runs,
        "successful_runs_count": success_runs,
        "in_progress_runs_count": in_progress,
        "last_synced_at": datetime.datetime.utcnow().isoformat() + "Z",
        "warnings": warnings
    }

@app.get("/api/v1/github/repos")
def get_repos(x_github_token: Optional[str] = Header(None)):
    data = db.get_data(x_github_token)
    return {"repos": data.get("repos", [])}

@app.get("/api/v1/github/workflows")
def get_workflows(x_github_token: Optional[str] = Header(None)):
    data = db.get_data(x_github_token)
    return {"workflows": data.get("workflows", [])}

@app.get("/api/v1/github/runs")
def get_runs(x_github_token: Optional[str] = Header(None)):
    data = db.get_data(x_github_token)
    # Sort runs by created_at descending
    runs = data.get("runs", [])
    runs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Compute counts
    failed_runs = sum(1 for r in runs if r["conclusion"] == "failure")
    success_runs = sum(1 for r in runs if r["conclusion"] == "success")
    in_progress = sum(1 for r in runs if r["status"] in ["in_progress", "queued", "pending"])
    
    return {
        "runs": runs,
        "summary": {
            "total": len(runs),
            "failed": failed_runs,
            "success": success_runs,
            "in_progress": in_progress
        },
        "last_synced_at": data.get("last_synced_at")
    }

@app.get("/api/v1/github/runs/{owner}/{repo}/{run_id}/logs")
def get_workflow_logs(owner: str, repo: str, run_id: str, x_github_token: Optional[str] = Header(None)):
    if not x_github_token:
        raise HTTPException(status_code=401, detail="GitHub PAT is missing")
    
    headers = get_github_headers(x_github_token)
    logs_url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    
    try:
        # Request logs. GitHub API returns a 302 redirect to a zip file.
        # Requests follows redirects by default.
        res = requests.get(logs_url, headers=headers, timeout=30)
        
        if res.status_code == 404:
            return {"status": "logs_unavailable", "message": "Logs have expired or were deleted."}
            
        res.raise_for_status()
        
        # The content should be a zip file. We extract the text.
        try:
            with zipfile.ZipFile(io.BytesIO(res.content)) as z:
                # Find the first log file, or combine them
                log_content = ""
                for filename in z.namelist():
                    if filename.endswith(".txt"):
                        log_content += f"\n--- {filename} ---\n"
                        log_content += z.read(filename).decode("utf-8", errors="replace")
                        
                # Truncate logs if too large (e.g. limit to last 20KB)
                if len(log_content) > 20000:
                    log_content = log_content[-20000:]
                    
                return {"status": "success", "logs": log_content}
        except zipfile.BadZipFile:
            # Maybe it returned plain text instead of zip?
            return {"status": "success", "logs": res.text[-20000:]}
            
    except Exception as e:
        logger.error(f"Error fetching logs for run {run_id}: {e}")
        return {"status": "logs_unavailable", "message": str(e)}

class RCARequest(BaseModel):
    repository: str

@app.post("/api/v1/github/runs/{run_id}/rca")
def generate_rca(run_id: str, req: RCARequest, x_github_token: Optional[str] = Header(None)):
    """Fetches logs and forwards to AI RCA service."""
    if not x_github_token:
        raise HTTPException(status_code=401, detail="GitHub PAT is missing")
        
    parts = req.repository.split("/")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid repository format. Expected owner/repo")
        
    owner, repo = parts[0], parts[1]
    
    # Get logs
    log_data = get_workflow_logs(owner, repo, run_id, x_github_token)
    raw_logs = log_data.get("logs", "Logs not available.")
    
    # Redact potential secrets from logs
    if x_github_token in raw_logs:
        raw_logs = raw_logs.replace(x_github_token, "[REDACTED_SECRET]")
        
    # Forward to ai-rca-service
    ai_rca_url = os.getenv("AI_RCA_SERVICE_URL", "http://ai-rca-service:8000")
    try:
        rca_res = requests.post(f"{ai_rca_url}/api/v1/rca/analyze", json={
            "source": "github_actions",
            "context": f"Workflow run {run_id} failed in {req.repository}.",
            "logs": raw_logs
        }, timeout=60)
        
        if rca_res.status_code != 200:
            return {"status": "partial_success", "diagnosis": "AI RCA is unavailable because Amazon Bedrock model access or billing is not configured. GitHub workflow data is still available.", "raw_logs": raw_logs}
            
        rca_data = rca_res.json()
        return {"status": "success", "diagnosis": rca_data.get("analysis", "No analysis returned."), "raw_logs": raw_logs}
        
    except Exception as e:
        logger.error(f"RCA generation failed: {e}")
        return {"status": "partial_success", "diagnosis": "AI RCA is unavailable because Amazon Bedrock model access or billing is not configured. GitHub workflow data is still available.", "raw_logs": raw_logs}
