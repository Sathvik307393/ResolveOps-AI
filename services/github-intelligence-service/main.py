from fastapi import FastAPI

app = FastAPI(title="github-intelligence-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "github-intelligence-service"}
