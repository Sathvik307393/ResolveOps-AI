from fastapi import FastAPI

app = FastAPI(title="notification-service")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "notification-service"}
