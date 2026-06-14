from fastapi import FastAPI

app = FastAPI(title="diagram-report-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "diagram-report-service"}
