import boto3
import os
import time

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

def get_users_table():
    return dynamodb.Table('NexusUsers')

def get_keys_table():
    return dynamodb.Table('NexusApiKeys')

def get_incidents_table():
    return dynamodb.Table('NexusIncidents')

def get_logs_table():
    return dynamodb.Table('NexusLogs')

