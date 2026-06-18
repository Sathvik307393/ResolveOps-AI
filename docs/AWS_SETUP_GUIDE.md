# AWS Setup Guide for ResolveOps AI

Because ResolveOps AI uses an IAM Role (or Access Keys) to discover your infrastructure securely, you need to create an IAM policy with the minimum required Read-Only permissions.

## 1. Create the IAM Policy

This JSON script contains the exact permissions the application needs to read telemetry and resources across EC2, EKS, RDS, S3, and CloudWatch.

1. Go to the **AWS Console** > **IAM** > **Policies**.
2. Click **Create Policy** and switch to the **JSON** tab.
3. Paste the following script:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ResolveOpsDiscoveryPermissions",
            "Effect": "Allow",
            "Action": [
                "ec2:Describe*",
                "eks:DescribeCluster",
                "rds:DescribeDBInstances",
                "s3:GetBucketLocation",
                "s3:ListAllMyBuckets",
                "cloudwatch:GetMetricData",
                "ce:GetCostAndUsage"
            ],
            "Resource": "*"
        }
    ]
}
```

4. Click **Next**, name the policy (e.g., `ResolveOps-ReadOnly-Policy`), and save it.

## 2. Create the IAM Role or User

### Option A: Using an IAM Role (Recommended - Cross Account AssumeRole)
1. Go to **IAM** > **Roles** > **Create Role**.
2. Select **AWS account** as the trusted entity type.
3. Enter the AWS Account ID where ResolveOps AI is hosted (if cross-account), or your own account ID.
4. Attach the `ResolveOps-ReadOnly-Policy` you just created.
5. Name the role (e.g., `ResolveOps-Integration-Role`) and save it.
6. Copy the **Role ARN** (e.g., `arn:aws:iam::123456789012:role/ResolveOps-Integration-Role`).

> **Note:** If you are assuming this role from a specific backend IAM role, ensure you configure the Trust Relationships tab to allow `sts:AssumeRole` from the ResolveOps backend role.

### Option B: Using an IAM User (Access Keys)
1. Go to **IAM** > **Users** > **Create User**.
2. Name the user (e.g., `resolveops-agent`).
3. Under Permissions, select **Attach policies directly** and attach your `ResolveOps-ReadOnly-Policy`.
4. Once the user is created, go to the **Security credentials** tab.
5. Click **Create access key**.
6. Save the **Access Key ID** and **Secret Access Key**.

## 3. Connect in ResolveOps AI
Now that you have your credentials:
1. Open the ResolveOps AI dashboard and navigate to the **Integrations** page.
2. Select **AWS** to connect.
3. Enter either the **Role ARN** (Option A) or your **Access Keys** (Option B) along with your primary region.
4. Click Connect. The system will validate the connection and your AWS Hub will immediately begin populating data!
