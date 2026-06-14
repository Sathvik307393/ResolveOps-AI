from fastapi import FastAPI

app = FastAPI(title="api-gateway-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "api-gateway-service"}
