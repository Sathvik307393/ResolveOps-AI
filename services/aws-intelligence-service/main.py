from fastapi import FastAPI

app = FastAPI(title="aws-intelligence-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "aws-intelligence-service"}
