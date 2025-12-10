# Valkey Semantic Cache Demo - Project Context

## Overview
AI-powered retail customer support system demonstrating semantic caching with ElastiCache (Valkey), AWS Bedrock AgentCore, and multi-agent orchestration.

## Current Status (2025-12-10)
**Phase**: Task 2 Complete ✅ → Ready for Task 3 (SupportAgent Integration)

**Completed:**
- ✅ ElastiCache cluster deployed with t4g.small
- ✅ Custom parameter group with 30% memory reserve for vector search
- ✅ Vector index `idx:requests` created (HNSW, 1024 dimensions, COSINE distance)
- ✅ EC2 development instance configured and operational
- ✅ @entrypoint implemented with Titan embeddings integration
- ✅ Cache hit/miss logic working (0.85 similarity threshold)
- ✅ AgentCore deployed in VPC mode with proper networking
- ✅ VPC endpoints created for AWS service access
- ✅ CloudWatch logging operational with detailed [ENTRYPOINT] logs
- ✅ Semantic caching validated end-to-end (92.66% similarity on test queries)

**Next:** Replace placeholder with actual SupportAgent implementation

## Infrastructure Details

### ElastiCache Cluster
- **Endpoint**: `sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com:6379`
- **Replication Group ID**: `sevoxy28zhyaiz6`
- **Node Type**: cache.t4g.small (required for vector search)
- **Parameter Group**: `semantic-cache-valkey8-params` (reserved-memory-percent=30)
- **Engine**: Valkey 8.2
- **VPC**: `vpc-0f9b5afd31283e9d1`
- **Security Group**: `sg-077091f3ac5a55b60` (allows port 6379 from VPC, port 22 from specific IP)
- **Subnets**: `subnet-0e80dd54d46959a91`, `subnet-0257db422851c0d6b`, `subnet-0da73b5aadcb5e744`

### VPC Endpoints (for AgentCore VPC mode)
- **CloudWatch Logs**: `vpce-0eb5baeede4df282d` (Interface)
- **Bedrock Runtime**: `vpce-0f361e12e51856ca9` (Interface)
- **ECR API**: `vpce-0fb178a07a0e7b4c9` (Interface)
- **ECR DKR**: `vpce-0597d204bc8363bc6` (Interface)
- **S3**: `vpce-08bb3ffc14ceafa55` (Gateway)
- **Cost**: ~$30/month (4 interface endpoints × $7.50 each)

### AgentCore Runtime
- **ARN**: `arn:aws:bedrock-agentcore:us-east-2:507286591552:runtime/semantic_cache_demo-J8d0xPB4e5`
- **Network Mode**: VPC (requires VPC endpoints for AWS service access)
- **Status**: READY and operational
- **CloudWatch Logs**: `/aws/bedrock-agentcore/runtimes/semantic_cache_demo-J8d0xPB4e5-DEFAULT`

### EC2 Development Instance
- **Name**: `semantic-cache-index-creator`
- **Type**: t3.micro
- **IP**: `18.221.90.67`
- **Key**: `semantic-cache-demo-key.pem`
- **Purpose**: Development and testing environment for agents
- **Repo**: Cloned at `/home/ec2-user/valkey-semantic-cache-demo`

### Vector Index Schema
```
Index: idx:requests
Fields:
  - request_id (TAG)
  - embedding (VECTOR HNSW, 1024 dimensions, COSINE distance)
    - M: 16
    - EF_CONSTRUCTION: 200
  - timestamp (NUMERIC)
Key Prefix: request:vector:
```

**Note**: Titan Embed Text v2 supports 256/512/1024 dimensions (not 1536). Using 1024 provides:
- Better retrieval quality with denser embeddings
- ~33% less storage in ElastiCache vs 1536
- Faster vector searches

## Tech Stack

### Core Infrastructure
- **AWS Bedrock AgentCore**: Multi-agent runtime with Strands framework
- **ElastiCache (Valkey 8.2)**: Vector database with HNSW indexing
- **CloudFormation**: Infrastructure as Code
- **EC2**: Development and testing environment

### AI Components
- **Claude Sonnet 4** (`anthropic.claude-sonnet-4-20250514-v1:0`): Primary SupportAgent
- **Claude 3.5 Sonnet v2** (`anthropic.claude-3-5-sonnet-20241022-v2:0`): OrderTrackingAgent
- **Titan Embeddings V2** (`amazon.titan-embed-text-v2:0`): 1024-dimensional vectors for semantic search
- **Strands Framework**: Agent orchestration, @entrypoint and @tool decorators

### Development
- **Python 3.12+**: Primary language for Strands agents
- **valkey-glide-sync>=2.1.1**: Valkey client library
- **Conventional Commits**: Git commit message format

## Architecture Flow

1. **Client** → Request arrives
2. **@entrypoint** → Generates Titan embedding, queries ElastiCache vector index
3. **Cache Hit (≥0.85 similarity)**: Returns cached response (<100ms)
4. **Cache Miss**: 
   - Forwards to SupportAgent (Claude Sonnet 4.0)
   - SupportAgent may consult OrderTrackingAgent (Claude Sonnet 3.5)
   - Response cached with embedding for future requests
5. **CloudWatch**: Metrics logged (latency, cost, hit ratio, match scores)

## Data Structures

### Vector Index (Semantic Search)
```
Key: request:vector:{uuid}
Fields:
  - request_id (TAG)
  - embedding (VECTOR HNSW, 1024 dimensions)
  - timestamp (NUMERIC)
```

### Request-Response Store
```
Key: rr:{request_id}
Hash:
  - request_text (string)
  - response_text (string)
  - tokens_input (numeric)
  - tokens_output (numeric)
  - cost_dollars (numeric)
  - created_at (timestamp)
  - agent_chain (string) # e.g., "SupportAgent->OrderTrackingAgent"
```

### Metrics Store
```
Key: metrics:global
Hash:
  - total_requests (numeric)
  - cache_hits (numeric)
  - cache_misses (numeric)
  - total_cost_savings_dollars (numeric)
  - avg_hit_proximity_match_score (numeric)
  - avg_latency_cached_ms (numeric)
  - avg_latency_uncached_ms (numeric)
```

## Key Directories
- `agents/`: Agent implementations (entrypoint.py, support_agent.py, order_tracking_agent.py)
- `infrastructure/`: CloudFormation templates, ElastiCache config, EC2 setup guide
- `scripts/`: Deployment automation (deploy-elasticache.sh, teardown-elasticache.sh)

## Important Lessons Learned

### ElastiCache Configuration
- t4g.small requires custom parameter group with 30% memory reserve for vector search
- Default parameter group (25% reserve) is insufficient
- Parameter changes require cluster reboot to apply

### Lambda Approach (Abandoned)
- Initial attempt to use Lambda for index creation was over-engineered
- Multiple issues: S3 bucket conflicts, IAM capabilities, timeout issues
- EC2 approach is simpler for development and testing

### Titan Embeddings Dimensions
- Titan Embed Text v2 defaults to 1024 dimensions (not 1536)
- Must explicitly specify `"dimensions": 1024` in API call
- Vector index dimension must match embedding dimension exactly
- Binary format required: `struct.pack(f'{len(embedding)}f', *embedding)`

### AgentCore VPC Mode
- VPC mode requires VPC endpoints for AWS service access (CloudWatch, Bedrock, ECR, S3)
- Without VPC endpoints, health checks fail silently
- Interface endpoints cost ~$7.50/month each, S3 gateway endpoint is free
- Security group must allow outbound HTTPS (port 443)

### GlideClient Initialization
- Must use `GlideClient.create(config)` factory method, not direct instantiation
- Direct instantiation causes `AttributeError: '_core_client'` errors

### CloudWatch Logging
- IAM policy must include `/aws/bedrock-agentcore/*` log group pattern
- Default `/aws/bedrock/*` pattern doesn't match AgentCore logs
- Logs appear after VPC endpoints are configured

### Security
- Security group allows SSH (port 22) only from specific IP
- ElastiCache (port 6379) accessible only from within VPC
- No 0.0.0.0/0 rules (not open to internet)

## Cost Estimates
- **ElastiCache (t4g.small)**: $38/month ($0.052/hour)
- **VPC Endpoints (4 interface)**: ~$30/month ($7.50 each)
- **EC2 (t3.micro)**: ~$0.01/hour (terminate when not in use)
- **Monthly total**: ~$68/month
- **10-day demo period**: ~$22.50

## Development Workflow
1. SSH into EC2: `ssh -i ~/.ssh/semantic-cache-demo-key.pem ec2-user@18.221.90.67`
2. Navigate to repo: `cd ~/valkey-semantic-cache-demo`
3. Test agents and cache logic directly from EC2
4. Commit changes from local machine
5. Pull updates on EC2: `git pull`

## AWS Profile
- **Profile Name**: `semantic-cache-demo`
- **Region**: `us-east-2`
- **Account ID**: `507286591552`

## Next Steps (Task 3)
- [ ] Design SupportAgent system prompt for retail support context
- [ ] Implement SupportAgent with Claude Sonnet 4.0
- [ ] Replace placeholder response in @entrypoint with actual agent invocation
- [ ] Test end-to-end: cache miss → SupportAgent → cache write → cache hit
- [ ] Validate response quality and latency metrics
