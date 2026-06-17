import boto3
import logging
from typing import List, Dict
from app.utils.aws_resource_normalizer import normalize_aws_resource

logger = logging.getLogger(__name__)

class AWSResourceDiscoveryService:
    def __init__(self, auth_kwargs: Dict):
        """
        auth_kwargs: Dictionary containing boto3 client initialization kwargs.
        Example: {'aws_access_key_id': '...', 'aws_secret_access_key': '...', 'region_name': 'us-east-1'}
        """
        self.auth_kwargs = auth_kwargs
        
        # We need account ID for generating ARNs manually if they aren't provided by the API
        try:
            sts = boto3.client('sts', **self.auth_kwargs)
            self.account_id = sts.get_caller_identity().get("Account")
        except Exception:
            self.account_id = "unknown"

    def _get_client(self, service_name: str, region: str):
        kwargs = self.auth_kwargs.copy()
        kwargs['region_name'] = region
        return boto3.client(service_name, **kwargs)

    def scan_regions(self, regions: List[str]) -> List[Dict]:
        """
        Scans specified regions for AWS resources.
        """
        all_resources = []
        for region in regions:
            logger.info(f"Scanning region: {region}")
            all_resources.extend(self._scan_vpcs(region))
            all_resources.extend(self._scan_ec2(region))
            all_resources.extend(self._scan_s3(region))
            all_resources.extend(self._scan_rds(region))
            all_resources.extend(self._scan_eks(region))
        return all_resources

    def _scan_vpcs(self, region: str) -> List[Dict]:
        resources = []
        try:
            ec2 = self._get_client('ec2', region)
            response = ec2.describe_vpcs()
            for vpc in response.get('Vpcs', []):
                vpc_id = vpc.get('VpcId')
                tags = {t['Key']: t['Value'] for t in vpc.get('Tags', [])}
                name = tags.get('Name', vpc_id)
                arn = f"arn:aws:ec2:{region}:{self.account_id}:vpc/{vpc_id}"
                
                resources.append(normalize_aws_resource(
                    account_id=self.account_id,
                    region=region,
                    resource_type="AWS::EC2::VPC",
                    resource_name=name,
                    arn=arn,
                    status=vpc.get('State', 'unknown'),
                    tags=tags,
                    metadata={"cidr_block": vpc.get('CidrBlock')}
                ))
        except Exception as e:
            logger.error(f"Failed to scan VPCs in {region}: {e}")
        return resources

    def _scan_ec2(self, region: str) -> List[Dict]:
        resources = []
        try:
            ec2 = self._get_client('ec2', region)
            response = ec2.describe_instances()
            for reservation in response.get('Reservations', []):
                for instance in reservation.get('Instances', []):
                    instance_id = instance.get('InstanceId')
                    tags = {t['Key']: t['Value'] for t in instance.get('Tags', [])}
                    name = tags.get('Name', instance_id)
                    arn = f"arn:aws:ec2:{region}:{self.account_id}:instance/{instance_id}"
                    
                    resources.append(normalize_aws_resource(
                        account_id=self.account_id,
                        region=region,
                        resource_type="AWS::EC2::Instance",
                        resource_name=name,
                        arn=arn,
                        status=instance.get('State', {}).get('Name', 'unknown'),
                        created_at=instance.get('LaunchTime'),
                        tags=tags,
                        metadata={
                            "instance_type": instance.get('InstanceType'),
                            "vpc_id": instance.get('VpcId'),
                            "subnet_id": instance.get('SubnetId'),
                            "private_ip": instance.get('PrivateIpAddress'),
                            "public_ip": instance.get('PublicIpAddress')
                        }
                    ))
        except Exception as e:
            logger.error(f"Failed to scan EC2 instances in {region}: {e}")
        return resources

    def _scan_s3(self, region: str) -> List[Dict]:
        resources = []
        try:
            s3 = self._get_client('s3', region)
            # S3 buckets are global but we only scan them once (we can do it on the first region)
            response = s3.list_buckets()
            for bucket in response.get('Buckets', []):
                name = bucket.get('Name')
                arn = f"arn:aws:s3:::{name}"
                
                # Try to get bucket location to match the current region scan
                try:
                    loc_response = s3.get_bucket_location(Bucket=name)
                    bucket_region = loc_response.get('LocationConstraint') or 'us-east-1'
                except Exception:
                    bucket_region = 'us-east-1'

                if bucket_region == region:
                    resources.append(normalize_aws_resource(
                        account_id=self.account_id,
                        region=bucket_region,
                        resource_type="AWS::S3::Bucket",
                        resource_name=name,
                        arn=arn,
                        status="available",
                        created_at=bucket.get('CreationDate'),
                        metadata={}
                    ))
        except Exception as e:
            logger.error(f"Failed to scan S3 buckets in {region}: {e}")
        return resources

    def _scan_rds(self, region: str) -> List[Dict]:
        resources = []
        try:
            rds = self._get_client('rds', region)
            response = rds.describe_db_instances()
            for db in response.get('DBInstances', []):
                name = db.get('DBInstanceIdentifier')
                arn = db.get('DBInstanceArn')
                
                resources.append(normalize_aws_resource(
                    account_id=self.account_id,
                    region=region,
                    resource_type="AWS::RDS::DBInstance",
                    resource_name=name,
                    arn=arn,
                    status=db.get('DBInstanceStatus', 'unknown'),
                    created_at=db.get('InstanceCreateTime'),
                    metadata={
                        "engine": db.get('Engine'),
                        "engine_version": db.get('EngineVersion'),
                        "instance_class": db.get('DBInstanceClass'),
                        "publicly_accessible": db.get('PubliclyAccessible', False)
                    }
                ))
        except Exception as e:
            logger.error(f"Failed to scan RDS instances in {region}: {e}")
        return resources

    def _scan_eks(self, region: str) -> List[Dict]:
        resources = []
        try:
            eks = self._get_client('eks', region)
            response = eks.list_clusters()
            for cluster_name in response.get('clusters', []):
                try:
                    cluster_info = eks.describe_cluster(name=cluster_name).get('cluster', {})
                    arn = cluster_info.get('arn')
                    
                    resources.append(normalize_aws_resource(
                        account_id=self.account_id,
                        region=region,
                        resource_type="AWS::EKS::Cluster",
                        resource_name=cluster_name,
                        arn=arn,
                        status=cluster_info.get('status', 'unknown'),
                        created_at=cluster_info.get('createdAt'),
                        tags=cluster_info.get('tags', {}),
                        metadata={
                            "version": cluster_info.get('version'),
                            "endpoint": cluster_info.get('endpoint'),
                            "role_arn": cluster_info.get('roleArn')
                        }
                    ))
                except Exception as ce:
                    logger.error(f"Failed to describe EKS cluster {cluster_name}: {ce}")
        except Exception as e:
            logger.error(f"Failed to scan EKS clusters in {region}: {e}")
        return resources
