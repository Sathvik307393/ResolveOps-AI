import boto3
import logging
import time
from typing import Dict, List, Any
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class AWSRuntimeService:
    def __init__(self, auth_kwargs: Dict):
        self.auth_kwargs = auth_kwargs

    def _get_client(self, service_name: str, region: str):
        kwargs = self.auth_kwargs.copy()
        if region:
            kwargs['region_name'] = region
        return boto3.client(service_name, **kwargs)

    def get_ec2_runtime(self, instance_id: str, region: str) -> Dict:
        """
        Attempts to fetch runtime info (containers, processes) from an EC2 instance via SSM.
        Returns a structured dictionary with partial_success pattern.
        """
        result = {
            "status": "unavailable",
            "message": "",
            "runtime": {
                "containers": [],
                "processes": []
            }
        }
        
        try:
            ssm = self._get_client('ssm', region)
            
            # 1. Check if SSM is available for this instance
            try:
                info = ssm.describe_instance_information(
                    InstanceInformationFilterList=[
                        {'key': 'InstanceIds', 'valueSet': [instance_id]}
                    ]
                )
                if not info.get("InstanceInformationList"):
                    result["status"] = "permission_required"
                    result["message"] = "Runtime discovery requires AWS Systems Manager or a ResolveOps agent."
                    return result
            except ClientError as e:
                result["status"] = "permission_required"
                result["message"] = f"Runtime discovery requires AWS Systems Manager or a ResolveOps agent. ({str(e)})"
                return result

            # 2. Try to run commands to get containers
            # Example command: docker ps --format '{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}'
            # Note: A real implementation would wait for the command invocation to complete.
            # Here we simulate the command request and return a mocked parsed response or error
            try:
                cmd = ssm.send_command(
                    InstanceIds=[instance_id],
                    DocumentName="AWS-RunShellScript",
                    Parameters={"commands": ["docker ps --format '{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}' || echo 'Docker not found'"]}
                )
                command_id = cmd['Command']['CommandId']
                
                # Mock a short wait (in real life, we poll or use event bridge)
                time.sleep(1)
                
                try:
                    invocation = ssm.get_command_invocation(
                        CommandId=command_id,
                        InstanceId=instance_id
                    )
                    
                    if invocation['Status'] == 'Success':
                        output = invocation['StandardOutputContent']
                        if 'Docker not found' not in output:
                            for line in output.strip().split('\n'):
                                if '|' in line:
                                    parts = line.split('|')
                                    if len(parts) >= 4:
                                        result["runtime"]["containers"].append({
                                            "id": parts[0],
                                            "image": parts[1],
                                            "status": parts[2],
                                            "name": parts[3]
                                        })
                    else:
                        result["message"] = "SSM command executed but did not succeed. Check SSM agent logs."
                        
                except ClientError as e:
                    # Invocation might not be ready
                    result["message"] = "Command sent, but unable to retrieve results yet."
            
            except ClientError as e:
                result["message"] = f"Failed to send SSM command: {str(e)}"
                
            result["status"] = "success" if result["runtime"]["containers"] else "partial_success"
            if not result["message"] and not result["runtime"]["containers"]:
                 result["message"] = "Systems Manager is running, but no containers or workloads were found."

        except Exception as e:
            logger.error(f"Error fetching runtime for EC2 {instance_id}: {e}")
            result["status"] = "error"
            result["message"] = f"Unexpected error during runtime discovery: {str(e)}"

        return result
