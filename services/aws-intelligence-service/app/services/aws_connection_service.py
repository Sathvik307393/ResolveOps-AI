import boto3
import logging
from botocore.exceptions import ClientError, NoCredentialsError
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

class AWSConnectionService:
    @staticmethod
    def validate_credentials(
        auth_method: str,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        role_arn: Optional[str] = None,
        external_id: Optional[str] = None,
        region: str = "us-east-1"
    ) -> Tuple[bool, Dict]:
        """
        Validates AWS credentials by making an STS GetCallerIdentity call.
        Returns a tuple of (success_boolean, result_data_or_error_dict).
        """
        try:
            if auth_method == "access_keys":
                if not access_key_id or not secret_access_key:
                    return False, {"error": "Access Key ID and Secret Access Key are required for access_keys method."}
                
                sts_client = boto3.client(
                    'sts',
                    aws_access_key_id=access_key_id,
                    aws_secret_access_key=secret_access_key,
                    region_name=region
                )
                
            elif auth_method == "role_arn":
                if not role_arn:
                    return False, {"error": "Role ARN is required for role_arn auth method."}
                
                # In production, this assumes the environment running the code has sts:AssumeRole permissions
                sts_client = boto3.client('sts', region_name=region)
                assume_kwargs = {
                    "RoleArn": role_arn,
                    "RoleSessionName": "NexusAIAWSDiscoverySession"
                }
                if external_id:
                    assume_kwargs["ExternalId"] = external_id
                    
                assumed_role = sts_client.assume_role(**assume_kwargs)
                credentials = assumed_role['Credentials']
                
                sts_client = boto3.client(
                    'sts',
                    aws_access_key_id=credentials['AccessKeyId'],
                    aws_secret_access_key=credentials['SecretAccessKey'],
                    aws_session_token=credentials['SessionToken'],
                    region_name=region
                )
            else:
                return False, {"error": "Unknown authentication method."}

            # Verify connection by getting caller identity
            identity = sts_client.get_caller_identity()
            
            return True, {
                "account_id": identity.get("Account"),
                "arn": identity.get("Arn"),
                "user_id": identity.get("UserId"),
                "status": "connected"
            }
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"AWS STS validation failed: {error_code} - {error_msg}")
            
            return False, {
                "error": "Authentication failed. Please verify your credentials and permissions.",
                "details": error_msg,
                "code": error_code
            }
        except NoCredentialsError:
            return False, {"error": "No AWS credentials could be found in the environment for AssumeRole."}
        except Exception as e:
            logger.error(f"Unexpected error validating AWS connection: {e}")
            return False, {"error": "An unexpected error occurred during connection validation."}
