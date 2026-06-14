from fastapi import FastAPI

app = FastAPI(title="ai-rca-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai-rca-service"}
