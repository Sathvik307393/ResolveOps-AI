import boto3
import os
import time
from typing import Optional

# Use the credentials and region configured in the environment
REGION = os.getenv("AWS_REGION", "us-east-1")
dynamodb = boto3.resource('dynamodb', region_name=REGION)

def init_dynamodb():
    """Auto-creates DynamoDB tables if they do not exist."""
    existing_tables = [table.name for table in dynamodb.tables.all()]
    
    if "NexusUsers" not in existing_tables:
        print("Creating NexusUsers DynamoDB table...")
        table = dynamodb.create_table(
            TableName='NexusUsers',
            KeySchema=[
                {'AttributeName': 'email', 'KeyType': 'HASH'}  # Partition key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'email', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        table.wait_until_exists()
        print("NexusUsers table created successfully!")

    if "NexusApiKeys" not in existing_tables:
        print("Creating NexusApiKeys DynamoDB table...")
        table = dynamodb.create_table(
            TableName='NexusApiKeys',
            KeySchema=[
                {'AttributeName': 'api_key', 'KeyType': 'HASH'}  # Partition key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'api_key', 'AttributeType': 'S'},
                {'AttributeName': 'user_id', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'UserIdIndex',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        table.wait_until_exists()
        print("NexusApiKeys table created successfully!")

    if "NexusIncidents" not in existing_tables:
        print("Creating NexusIncidents DynamoDB table...")
        table = dynamodb.create_table(
            TableName='NexusIncidents',
            KeySchema=[
                {'AttributeName': 'tenant_id', 'KeyType': 'HASH'},  # Partition key
                {'AttributeName': 'incident_id', 'KeyType': 'RANGE'} # Sort key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'tenant_id', 'AttributeType': 'S'},
                {'AttributeName': 'incident_id', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        table.wait_until_exists()
        print("NexusIncidents table created successfully!")

    if "NexusLogs" not in existing_tables:
        print("Creating NexusLogs DynamoDB table...")
        table = dynamodb.create_table(
            TableName='NexusLogs',
            KeySchema=[
                {'AttributeName': 'tenant_id', 'KeyType': 'HASH'},  # Partition key
                {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}  # Sort key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'tenant_id', 'AttributeType': 'S'},
                {'AttributeName': 'timestamp', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        table.wait_until_exists()
        print("NexusLogs table created successfully!")

    if "NexusDeployments" not in existing_tables:
        print("Creating NexusDeployments DynamoDB table...")
        table = dynamodb.create_table(
            TableName='NexusDeployments',
            KeySchema=[
                {'AttributeName': 'tenant_id', 'KeyType': 'HASH'},  # Partition key
                {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}  # Sort key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'tenant_id', 'AttributeType': 'S'},
                {'AttributeName': 'timestamp', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        table.wait_until_exists()
        print("NexusDeployments table created successfully!")

def get_users_table():
    return dynamodb.Table('NexusUsers')

def get_keys_table():
    return dynamodb.Table('NexusApiKeys')

def get_incidents_table():
    return dynamodb.Table('NexusIncidents')

def get_logs_table():
    return dynamodb.Table('NexusLogs')

# --- Log Storage Abstraction Layer (Repository Pattern) ---
def store_log(tenant_id: str, timestamp: str, log_data: dict) -> bool:
    """Stores a log entry using the decoupled repository layer."""
    try:
        table = get_logs_table()
        table.put_item(Item={
            'tenant_id': tenant_id,
            'timestamp': timestamp,
            'service': log_data.get('service', 'unknown'),
            'level': log_data.get('level', 'INFO'),
            'message': log_data.get('message', ''),
            'latency_ms': str(log_data.get('latency_ms')) if log_data.get('latency_ms') is not None else None,
            'status_code': log_data.get('status_code'),
            'request_id': log_data.get('request_id'),
            'cluster_id': log_data.get('cluster_id'),
            'resource_id': log_data.get('resource_id')
        })
        return True
    except Exception as e:
        print(f"Log Repository write failed: {e}")
        return False

def get_logs(tenant_id: str, limit: int = 50) -> list:
    """Retrieves logs using the decoupled repository layer."""
    try:
        table = get_logs_table()
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('tenant_id').eq(tenant_id),
            ScanIndexForward=False,
            Limit=limit
        )
        return response.get('Items', [])
    except Exception as e:
        print(f"Log Repository read failed: {e}")
        return []

# --- Reliability Score Integration ---
def update_reliability_score(email: str, score: float) -> bool:
    """Updates the user's/tenant's reliability score in their user profile."""
    try:
        table = get_users_table()
        # Ensure score is within valid bounds [0, 100]
        clamped_score = max(0.0, min(100.0, float(score)))
        table.update_item(
            Key={'email': email},
            UpdateExpression="SET reliability_score = :score",
            ExpressionAttributeValues={':score': str(clamped_score)}
        )
        return True
    except Exception as e:
        print(f"Failed to update reliability score for {email}: {e}")
        return False

def get_reliability_score(email: str) -> float:
    """Retrieves the reliability score for a given tenant email."""
    try:
        table = get_users_table()
        response = table.get_item(Key={'email': email})
        if 'Item' in response:
            return float(response['Item'].get('reliability_score', 100.0))
        return 100.0
    except Exception as e:
        print(f"Failed to fetch reliability score: {e}")
        return 100.0

def get_deployments_table():
    return dynamodb.Table('NexusDeployments')

def store_deployment(tenant_id: str, timestamp: str, deploy_data: dict) -> bool:
    """Stores GitHub deployment metadata for correlation."""
    try:
        table = get_deployments_table()
        table.put_item(Item={
            'tenant_id': tenant_id,
            'timestamp': timestamp,
            'commit_sha': deploy_data.get('commit_sha', 'unknown'),
            'commit_msg': deploy_data.get('commit_msg', ''),
            'author': deploy_data.get('author', ''),
            'repository': deploy_data.get('repository', ''),
            'workflow_run_id': deploy_data.get('workflow_run_id'),
            'pr_url': deploy_data.get('pr_url', '')
        })
        return True
    except Exception as e:
        print(f"Deployment storage failed: {e}")
        return False

def get_latest_deployment(tenant_id: str) -> Optional[dict]:
    """Retrieves the latest deployment for correlation."""
    try:
        table = get_deployments_table()
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('tenant_id').eq(tenant_id),
            ScanIndexForward=False, # Newest first
            Limit=1
        )
        items = response.get('Items', [])
        return items[0] if items else None
    except Exception as e:
        print(f"Failed to retrieve latest deployment: {e}")
        return None



