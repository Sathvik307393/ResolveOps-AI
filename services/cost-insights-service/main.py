from fastapi import FastAPI

app = FastAPI(title="cost-insights-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "cost-insights-service"}
