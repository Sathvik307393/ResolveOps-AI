from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.aws_connection_service import AWSConnectionService

router = APIRouter(prefix="/api/v1/aws", tags=["AWS Connection"])

class AWSConnectRequest(BaseModel):
    connection_name: str = Field(..., description="A friendly name for this connection")
    auth_method: str = Field(..., description="'role_arn' or 'access_keys'")
    role_arn: Optional[str] = None
    external_id: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    default_region: str = Field(default="us-east-1")
    enabled_regions: List[str] = Field(default_factory=lambda: ["us-east-1"])

@router.post("/connect")
def connect_aws_account(payload: AWSConnectRequest = Body(...)):
    """
    Validates the provided AWS credentials and initializes the connection.
    Does NOT store or log the secret access keys.
    """
    success, result = AWSConnectionService.validate_credentials(
        auth_method=payload.auth_method,
        access_key_id=payload.access_key_id,
        secret_access_key=payload.secret_access_key,
        role_arn=payload.role_arn,
        external_id=payload.external_id,
        region=payload.default_region
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=result)
        
    return {
        "message": "AWS connection validated successfully.",
        "connection_details": {
            "name": payload.connection_name,
            "account_id": result.get("account_id"),
            "auth_method": payload.auth_method,
            "default_region": payload.default_region,
            "enabled_regions": payload.enabled_regions,
            "status": "connected"
        }
    }

@router.get("/status")
def get_aws_status():
    """
    Returns the current connection status of the AWS intelligence module.
    """
    # In a full implementation, this would check the DB for saved credentials
    return {
        "status": "disconnected",
        "message": "No active AWS connection found."
    }
