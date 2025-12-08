# EC2 Setup for Vector Index Creation

Quick guide to create the vector index using an EC2 instance.

## Prerequisites

- ElastiCache cluster deployed and running ✅
- ElastiCache endpoint: `sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com`
- Security group: `sg-077091f3ac5a55b60`
- VPC: `vpc-0f9b5afd31283e9d1`
- Subnets: `subnet-0e80dd54d46959a91`, `subnet-0257db422851c0d6b`, `subnet-0da73b5aadcb5e744`

## Step 1: Launch EC2 Instance

### Via AWS Console (Recommended)

1. Go to **EC2** → **Launch Instance**
2. **Name**: `semantic-cache-index-creator`
3. **AMI**: Amazon Linux 2023
4. **Instance type**: t3.micro (free tier eligible)
5. **Key pair**: Create new or use existing
6. **Network settings**:
   - VPC: `vpc-0f9b5afd31283e9d1`
   - Subnet: `subnet-0e80dd54d46959a91` (or any of the 3)
   - Auto-assign public IP: **Enable**
   - Security group: Select existing `sg-077091f3ac5a55b60` OR create new with:
     - Inbound: SSH (22) from your IP
     - Outbound: All traffic
7. **IAM Instance Profile**: Create or select a role with the following permissions (see Step 1.1)
8. Click **Launch**

### Step 1.1: Configure IAM Instance Role

The EC2 instance needs permissions for AgentCore deployment. Create a role with these inline policies:

**Policy 1: AgentCoreDeploymentPolicy**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:*",
        "codebuild:*",
        "bedrock:*",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

**Policy 2: AgentCoreIAMManagement**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:PutRolePolicy",
                "iam:AttachRolePolicy",
                "iam:GetRole",
                "iam:PassRole",
                "iam:DeleteRolePolicy",
                "iam:DetachRolePolicy",
                "iam:ListAttachedRolePolicies",
                "iam:ListRolePolicies"
            ],
            "Resource":
                "arn:aws:iam::*:role/AmazonBedrockAgentCore*"
            ]
        }
    ]
}
```

**Policy 3: AgentCoreS3Access**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject",
        "s3:PutBucketVersioning",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutLifecycleConfiguration"
      ],
      "Resource": [
        "arn:aws:s3:::bedrock-agentcore-codebuild-sources-*",
        "arn:aws:s3:::bedrock-agentcore-codebuild-sources-*/*"
      ]
    }
  ]
}
```

**Policy 4: CodeBuildRoleManagement**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["iam:PutRolePolicy"],
      "Resource": "arn:aws:iam::*:role/AmazonBedrockAgentCoreSDKCodeBuild-*"
    }
  ]
}
```

**Or use AWS Managed Policies (simpler):**

- `AmazonEC2ContainerRegistryFullAccess`
- `AWSCodeBuildAdminAccess`
- `AmazonBedrockFullAccess`
- `IAMFullAccess` (or scoped IAM permissions above)
- `AmazonS3FullAccess` (or scoped S3 permissions above)

### Via CLI (Alternative)

```bash
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --instance-type t3.micro \
  --key-name <YOUR_KEY_NAME> \
  --security-group-ids sg-077091f3ac5a55b60 \
  --subnet-id subnet-0e80dd54d46959a91 \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=semantic-cache-index-creator}]' \
  --profile semantic-cache-demo \
  --region us-east-2
```

## Step 2: Connect to EC2

```bash
# Get instance public IP from AWS Console or:
INSTANCE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=semantic-cache-index-creator" "Name=instance-state-name,Values=running" \
  --profile semantic-cache-demo \
  --region us-east-2 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# SSH in
ssh -i ~/.ssh/<YOUR_KEY>.pem ec2-user@$INSTANCE_IP
```

## Step 3: Install Dependencies

```bash
# Update system
sudo dnf update -y

# Install Python 3.12 and git
sudo dnf install -y python3.12 python3.12-pip git

# Install valkey dependencies (both sync and full client)
pip3.12 install "valkey-glide-sync>=2.1.1" "valkey-glide[all]>=2.2.1"

# Install additional dependencies for entrypoint testing
pip3.12 install boto3 mypy-boto3-bedrock-runtime
```

## Step 4: Clone Repository and Run Script

```bash
# Clone the repo
git clone https://github.com/vasigorc/valkey-semantic-cache-demo.git
cd valkey-semantic-cache-demo

# Run index creation script
ELASTICACHE_ENDPOINT=sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com \
ELASTICACHE_PORT=6379 \
python3.12 infrastructure/elasticache_config/create_vector_index.py
```

**Expected output:**

```
============================================================
Semantic Cache Demo - Vector Index Setup
============================================================

Connecting to: sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com:6379
✓ Connected to ElastiCache cluster

Creating index 'idx:requests'...
✓ Created vector index: idx:requests
  - Dimensions: 1536
  - Distance metric: COSINE
  - HNSW M: 16
  - HNSW EF_CONSTRUCTION: 200
  - Key prefix: request:vector:

Verifying index...
✓ Index verified: idx:requests

============================================================
Vector index setup complete!
============================================================
```

## Step 5: Fix CodeBuild CloudWatch Logs Permissions

AgentCore creates the CodeBuild service role but doesn't attach CloudWatch Logs permissions. Add them manually:

```bash
aws iam put-role-policy \
  --role-name AmazonBedrockAgentCoreSDKCodeBuild-us-east-2-0d4931938d \
  --policy-name CloudWatchLogsPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": "arn:aws:logs:us-east-2:507286591552:log-group:/aws/codebuild/*"
      }
    ]
  }' \
  --region us-east-2
```

Similarly AgentCore doesn't attach necessary S3 permissions to download the source code:

```bash
aws iam put-role-policy \
  --role-name AmazonBedrockAgentCoreSDKCodeBuild-us-east-2-0d4931938d \
  --policy-name S3SourceAccessPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject",
          "s3:GetObjectVersion"
        ],
        "Resource": "arn:aws:s3:::bedrock-agentcore-codebuild-sources-507286591552-us-east-2/*"
      }
    ]
  }' \
  --region us-east-2

```

**Note**: Replace the role name and account ID if different in your deployment.

## Step 6: Verify Index (Optional)

```bash
# Install redis-cli for manual verification
sudo dnf install -y redis6

# Connect to ElastiCache
redis-cli -h sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com -p 6379

# In redis-cli, check index info:
FT.INFO idx:requests

# Exit redis-cli
exit
```

## Step 7: Terminate EC2

Once index is created successfully:

```bash
# Exit SSH
exit

# Terminate instance (from your local machine)
aws ec2 terminate-instances \
  --instance-ids <INSTANCE_ID> \
  --profile semantic-cache-demo \
  --region us-east-2
```

Or terminate via AWS Console: EC2 → Instances → Select instance → Instance state → Terminate

## Troubleshooting

### Cannot connect to ElastiCache

**Error**: Connection timeout or refused

**Solution**:

- Verify EC2 is in same VPC (`vpc-0f9b5afd31283e9d1`)
- Check security group `sg-077091f3ac5a55b60` allows traffic on port 6379
- Verify ElastiCache endpoint is correct

### Python module not found

**Error**: `ModuleNotFoundError: No module named 'glide_sync'`

**Solution**:

```bash
# Ensure using python3.12
which python3.12
python3.12 -m pip list | grep valkey

# Reinstall if needed
pip3.12 install --upgrade valkey-glide-sync
```

### Memory reserve error

**Error**: "please configure memory reserve to 50% on a micro instance or 30% on a small"

**Solution**: This has been resolved. The CloudFormation template now includes a custom parameter group with 30% memory reserve for t4g.small instances.

## Cost

- **EC2 t3.micro**: ~$0.01/hour
- **Typical usage**: 10-15 minutes
- **Total cost**: < $0.01

## Next Steps

After index creation:

- ✅ Task 2 complete: ElastiCache Integration
- → Task 3: SupportAgent Integration
- → Task 4: CloudWatch Integration
- → Task 5: Multi-Agent Scenario
