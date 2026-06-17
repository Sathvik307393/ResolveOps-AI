import boto3
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class AWSRiskAnalysisService:
    def __init__(self, auth_kwargs: Dict):
        self.auth_kwargs = auth_kwargs

    def analyze_resource(self, resource: Dict) -> List[Dict]:
        """
        Analyzes a single normalized resource and returns a list of identified risks.
        """
        risks = []
        res_type = resource.get('resource_type', '')
        
        # General Status Check
        status = resource.get('status', '').lower()
        if status in ['stopped', 'failed', 'terminated', 'degraded']:
            risks.append({
                "id": f"risk-{resource['id']}-status",
                "severity": "high",
                "title": f"Resource {status.capitalize()}",
                "description": f"The resource is currently in a {status} state.",
                "recommendation": "Investigate the root cause in CloudWatch logs or instance health checks."
            })

        # EC2 Specific Risks
        if res_type == 'AWS::EC2::Instance':
            if resource.get('metadata', {}).get('public_ip'):
                risks.append({
                    "id": f"risk-{resource['id']}-public-ip",
                    "severity": "medium",
                    "title": "Public IP Attached",
                    "description": "EC2 instance has a public IP, exposing it to the internet.",
                    "recommendation": "Use a private subnet and ALB/NAT Gateway instead."
                })

        # S3 Specific Risks
        elif res_type == 'AWS::S3::Bucket':
            # In a full implementation, we'd query GetBucketPublicAccessBlock
            # For now, we mock the risk generation based on naming or tags
            pass

        # RDS Specific Risks
        elif res_type == 'AWS::RDS::DBInstance':
            if resource.get('metadata', {}).get('publicly_accessible'):
                risks.append({
                    "id": f"risk-{resource['id']}-rds-public",
                    "severity": "critical",
                    "title": "Database is Publicly Accessible",
                    "description": "RDS instance allows public internet access.",
                    "recommendation": "Disable Publicly Accessible flag and restrict security groups."
                })

        return risks
