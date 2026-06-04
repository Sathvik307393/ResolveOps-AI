from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from rag.rag_engine import LogRageEngine
from typing import Optional

app = FastAPI(
    title="NexusAI Bot API",
    description="Programmatic API for NexusAI DevSecOps Bot",
    version="1.0.0"
)

# Initialize the engine once at startup
engine = LogRageEngine()

class ChatRequest(BaseModel):
    query: str
    time_window_mins: Optional[int] = 30

class ChatResponse(BaseModel):
    answer: str
    citations: list

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        result = engine.run_query(request.query, request.time_window_mins)
        return ChatResponse(
            answer=result.get("answer", ""),
            citations=result.get("citations", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
