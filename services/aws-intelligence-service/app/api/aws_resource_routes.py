from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.services.aws_resource_discovery_service import AWSResourceDiscoveryService
from app.services.aws_cost_service import AWSCostService
from app.services.aws_risk_analysis_service import AWSRiskAnalysisService
from app.services.aws_cloudwatch_service import AWSCloudWatchService
from app.services.aws_eks_visibility_service import AWSEKSVisibilityService
from app.services.aws_subresource_service import AWSSubResourceService
from app.services.aws_runtime_service import AWSRuntimeService

router = APIRouter(prefix="/api/v1/aws/resources", tags=["AWS Resources"])

# In-memory mock for now since we asked the user about DB choices
_db_cache = {}

class SyncRequest(BaseModel):
    auth_method: str = "environment"
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    role_arn: Optional[str] = None
    external_id: Optional[str] = None
    regions: List[str] = ["us-east-1"]

@router.post("/sync")
def sync_resources(req: SyncRequest = Body(...)):
    """
    Triggers a manual sync of all AWS resources across specified regions.
    """
    auth_kwargs = {}
    if req.auth_method == "access_keys":
        if not req.access_key_id or not req.secret_access_key:
            raise HTTPException(status_code=400, detail="Missing access keys")
        auth_kwargs = {
            'aws_access_key_id': req.access_key_id,
            'aws_secret_access_key': req.secret_access_key
        }
    elif req.auth_method == "role_arn":
        # Role assume logic would go here to generate temp credentials
        pass
    elif req.auth_method == "environment":
        # Leave auth_kwargs empty to use boto3 default resolution (.env or EC2 role)
        auth_kwargs = {}
    else:
        raise HTTPException(status_code=400, detail="Invalid auth method")

    try:
        service = AWSResourceDiscoveryService(auth_kwargs)
        resources = service.scan_regions(req.regions)
        
        # Simple cache logic
        _db_cache["resources"] = resources
        
        ec2_instances = [r for r in resources if "EC2" in r.get("resource_type", "")]
        ec2 = len(ec2_instances)
        ec2_running = sum(1 for r in ec2_instances if r.get("status", "").lower() == "running")
        ec2_stopped = sum(1 for r in ec2_instances if r.get("status", "").lower() == "stopped")
        
        rds = sum(1 for r in resources if "RDS" in r.get("resource_type", ""))
        eks = sum(1 for r in resources if "EKS" in r.get("resource_type", ""))
        s3 = sum(1 for r in resources if "S3" in r.get("resource_type", ""))
        
        # Check if Cost Explorer failed
        warnings = []
        if any(r.get("cost_status") == "permission_required" for r in resources):
            warnings.append({
                "service": "cost-explorer",
                "message": "Cost Explorer permission required. Cost data unavailable."
            })
            
        status_str = "partial_success" if warnings else "success"
        
        return {
            "status": status_str,
            "account_id": service.account_id if hasattr(service, "account_id") else "",
            "regions_scanned": req.regions,
            "resources_count": len(resources),
            "summary": {
                "ec2_instances": ec2,
                "ec2_running": ec2_running,
                "ec2_stopped": ec2_stopped,
                "rds_databases": rds,
                "eks_clusters": eks,
                "s3_buckets": s3
            },
            "warnings": warnings,
            "resources": resources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync AWS resources: {str(e)}")

@router.get("")
def get_resources():
    """
    Returns the discovered resources.
    """
    return {"resources": _db_cache.get("resources", [])}

@router.get("/{resource_id:path}")
def get_resource(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

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

@router.get("/{resource_id:path}/metrics")
def get_resource_metrics(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    service = AWSCloudWatchService({})
    metrics = service.fetch_metrics(
        resource_id, 
        resource.get("resource_type", ""),
        resource.get("region", "us-east-1")
    )
    return {"metrics": metrics}

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

@router.get("/{resource_id:path}/events")
def get_resource_events(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    # Remove the generic mock. Since we don't have an event service implemented, we can return empty
    # to signify no events instead of a fake mock that confuses the user.
    return {"events": []}

@router.get("/{resource_id:path}/subresources")
def get_resource_subresources(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    service = AWSSubResourceService({})
    return service.get_subresources(
        resource.get("resource_type", ""),
        resource_id,
        resource.get("resource_name", ""),
        resource.get("region", "us-east-1")
    )

@router.get("/{resource_id:path}/runtime")
def get_resource_runtime(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    if "EC2" not in resource.get("resource_type", ""):
        raise HTTPException(status_code=400, detail="Runtime discovery is only supported for EC2 instances")
        
    service = AWSRuntimeService({})
    return service.get_ec2_runtime(
        resource_id.split("/")[-1] if "/" in resource_id else resource_id, # Extract instance id
        resource.get("region", "us-east-1")
    )

@router.get("/{resource_id:path}/relationships")
def get_resource_relationships(resource_id: str):
    resources = _db_cache.get("resources", [])
    resource = next((r for r in resources if r["id"] == resource_id), None)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    relationships = []
    meta = resource.get("metadata", {})
    res_type = resource.get("resource_type", "")
    
    if "EC2" in res_type:
        if meta.get("vpc_id"): relationships.append({"type": "VPC", "id": meta.get("vpc_id")})
        if meta.get("subnet_id"): relationships.append({"type": "Subnet", "id": meta.get("subnet_id")})
        for sg in meta.get("security_groups", []):
            relationships.append({"type": "SecurityGroup", "id": sg.get("GroupId", sg)})
    
    elif "LoadBalancer" in res_type:
        # Load balancers have VPCs and subnets typically
        if meta.get("vpc_id"): relationships.append({"type": "VPC", "id": meta.get("vpc_id")})
        for sn in meta.get("subnets", []):
            relationships.append({"type": "Subnet", "id": sn})
            
    elif "RDS" in res_type:
        if meta.get("subnet_group"): relationships.append({"type": "DB Subnet Group", "id": meta.get("subnet_group")})
        
    elif "S3" in res_type:
        relationships.append({"type": "Bucket Policy", "id": "Policy"})
            
    return {"relationships": relationships}
