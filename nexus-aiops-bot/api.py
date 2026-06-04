from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
from rag.rag_engine import LogRageEngine
from typing import Optional, List
import jwt
import datetime
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import engine as db_engine, Base, get_db
import models

# Create database tables
Base.metadata.create_all(bind=db_engine)

app = FastAPI(
    title="NexusAI SaaS API",
    description="Multi-tenant SaaS API for NexusAI",
    version="2.0.0"
)

engine = LogRageEngine()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

JWT_SECRET = "super_secret_jwt_key_for_nexus_saas"

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

# --- Auth Endpoints ---
@app.post("/register")
def register_user(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-generate first API key
    new_key = models.ApiKey(user_id=new_user.id, name="Default Integration Key")
    db.add(new_key)
    db.commit()
    
    return {"message": "User registered successfully"}

@app.post("/login")
def login_user(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = jwt.encode({
        "user_id": db_user.id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, JWT_SECRET, algorithm="HS256")
    
    return {"token": token}

# --- Protected API Key Endpoints ---
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/keys", response_model=List[ApiKeyResponse])
def get_api_keys(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.query(models.ApiKey).filter(models.ApiKey.user_id == current_user.id).all()
    return [{"key": k.key, "name": k.name} for k in keys]

@app.post("/api/keys/generate", response_model=ApiKeyResponse)
def generate_api_key(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_key = models.ApiKey(user_id=current_user.id, name=f"Key {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    return {"key": new_key.key, "name": new_key.name}

# --- Core Bot Endpoint (Secured via API Key) ---
def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    # The client can pass the API key in the Bearer token field
    api_key = credentials.credentials
    key_record = db.query(models.ApiKey).filter(models.ApiKey.key == api_key, models.ApiKey.is_active == True).first()
    
    if not key_record:
        raise HTTPException(status_code=401, detail="Invalid or revoked API Key")
    return key_record.owner

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, current_user: models.User = Depends(verify_api_key)):
    try:
        # In a real multi-tenant SaaS, you would scope the RAG query to current_user.id
        # e.g. result = engine.run_query(request.query, request.time_window_mins, current_user.id)
        result = engine.run_query(request.query, request.time_window_mins)
        return ChatResponse(
            answer=result.get("answer", ""),
            citations=result.get("citations", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
