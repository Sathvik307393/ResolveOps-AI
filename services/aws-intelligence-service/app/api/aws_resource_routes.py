from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
from app.services.aws_resource_discovery_service import AWSResourceDiscoveryService
from app.services.aws_cost_service import AWSCostService
from app.services.aws_risk_analysis_service import AWSRiskAnalysisService
from app.services.aws_cloudwatch_service import AWSCloudWatchService
from app.services.aws_eks_visibility_service import AWSEKSVisibilityService

router = APIRouter(prefix="/api/v1/aws/resources", tags=["AWS Resources"])

# In-memory mock for now since we asked the user about DB choices
_db_cache = {}

@router.post("/sync")
def sync_resources(
    auth_method: str,
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    role_arn: Optional[str] = None,
    external_id: Optional[str] = None,
    regions: List[str] = ["us-east-1"]
):
    """
    Triggers a manual sync of all AWS resources across specified regions.
    """
    auth_kwargs = {}
    if auth_method == "access_keys":
        if not access_key_id or not secret_access_key:
            raise HTTPException(status_code=400, detail="Missing access keys")
        auth_kwargs = {
            'aws_access_key_id': access_key_id,
            'aws_secret_access_key': secret_access_key
        }
    elif auth_method == "role_arn":
        # Role assume logic would go here to generate temp credentials
        pass
    else:
        raise HTTPException(status_code=400, detail="Invalid auth method")

    service = AWSResourceDiscoveryService(auth_kwargs)
    resources = service.scan_regions(regions)
    
    # Simple cache logic
    _db_cache["resources"] = resources
    
    return {
        "message": f"Successfully synced {len(resources)} resources across {len(regions)} regions.",
        "count": len(resources),
        "resources": resources
    }

@router.get("")
def get_resources():
    """
    Returns the discovered resources.
    """
    return {"resources": _db_cache.get("resources", [])}

@router.get("/{resource_id:path}/cost")
def get_resource_cost(resource_id: str):
    # Retrieve the resource to get its region
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    # Mocking auth_kwargs for now (should be fetched from DB securely)
    service = AWSCostService({})
    cost_data = service.get_resource_cost(resource_id, resource.get("region", "us-east-1"))
    return cost_data

@router.get("/{resource_id:path}/risks")
def get_resource_risks(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    service = AWSRiskAnalysisService({})
    risks = service.analyze_resource(resource)
    return {"risks": risks}

@router.get("/{resource_id:path}/logs")
def get_resource_logs(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    service = AWSCloudWatchService({})
    logs = service.fetch_recent_logs(resource_id, resource.get("region", "us-east-1"))
    return {"logs": logs}

@router.get("/{resource_id:path}/workloads")
def get_eks_workloads(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    if "EKS" not in resource.get("resource_type", ""):
        raise HTTPException(status_code=400, detail="Resource is not an EKS cluster")
        
    service = AWSEKSVisibilityService({})
    return service.get_cluster_workloads(resource.get("resource_name"), resource.get("region", "us-east-1"))
