# Valkey Semantic Cache Demo - Project Context

## Overview
AI-powered retail customer support system demonstrating semantic caching with ElastiCache (Valkey), AWS Bedrock AgentCore, and multi-agent orchestration.

## Current Status (2025-12-22)
**Phase**: Task 11 In Progress - Demo UI API deployed

**Completed (Tasks 1-10):**
- ✅ ElastiCache cluster deployed with t4g.small, HNSW vector index (1024 dims)
- ✅ AgentCore deployed in VPC mode with multi-agent orchestration
- ✅ SupportAgent (Claude Sonnet 4) + OrderTrackingAgent (Claude 3.5 Haiku)
- ✅ Semantic caching with 0.80 similarity threshold
- ✅ CloudWatch dashboard with metrics (latency, cost, hit ratio, pie chart)
- ✅ Ramp-up Lambda (Go): 1→11 RPS over 180s, 50 base + 450 variations
- ✅ Cache Management Lambda (Python): health-check, reset-cache, create-index
- ✅ CodeBuild automation for AgentCore deployment (no EC2 jump host needed!)
- ✅ **Single-command deployment: `./deploy.sh`**
- ✅ **Single-command teardown: `./teardown.sh`**

**Task 11 Progress:**
- ✅ Demo UI API Lambda deployed (`semantic-cache-demo-demo-ui-api`)
- ✅ API Gateway: GET /metrics, POST /start, POST /reset
- ✅ API URL: `https://jf2tdknu19.execute-api.us-east-2.amazonaws.com/Prod`
- 🔲 Static HTML/JS frontend (next step)

**Key Scripts:**
- `deploy.sh` - Deploy all 7 stacks (supports `--deploy-agent`, `--create-index`, `--all`)
- `teardown.sh` - Delete all stacks (supports `--force`)
- `scripts/trigger-agent-deploy.sh` - Deploy/update AgentCore agent

**Deferred:**
- CDK migration scaffolded but deferred to post-demo (master scripts achieve the goal)

**Next Tasks:**
- Task 11: Simple demo UI
- Task 12: Simplified 5-minute demo script

## Infrastructure Details

### ElastiCache Cluster
- **Endpoint**: `sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com:6379`
- **Node Type**: cache.t4g.small
- **Engine**: Valkey 8.2
- **VPC**: `vpc-0f9b5afd31283e9d1`
- **Security Group**: `sg-077091f3ac5a55b60`
- **Subnets**: `subnet-0e80dd54d46959a91`, `subnet-0257db422851c0d6b`, `subnet-0da73b5aadcb5e744`

### AgentCore Runtime
- **ARN**: `arn:aws:bedrock-agentcore:us-east-2:507286591552:runtime/semantic_cache_demo-J8d0xPB4e5`
- **Network Mode**: VPC
- **CloudWatch Logs**: `/aws/bedrock-agentcore/runtimes/semantic_cache_demo-J8d0xPB4e5-DEFAULT`

### AgentCore CLI Commands (for Task 10 automation)
```bash
# Configure (non-interactive with -ni flag)
agentcore configure \
  --entrypoint entrypoint.py \
  --name semantic_cache_demo \
  --execution-role arn:aws:iam::507286591552:role/AgentCoreRuntime-us-east-2 \
  --code-build-execution-role arn:aws:iam::507286591552:role/AgentCoreCodeBuild-us-east-2 \
  --disable-memory \
  --region us-east-2 \
  --vpc \
  --subnets subnet-0257db422851c0d6b,subnet-0da73b5aadcb5e744,subnet-0e80dd54d46959a91 \
  --security-groups sg-077091f3ac5a55b60

# Deploy with environment variables
agentcore deploy \
  --env ELASTICACHE_ENDPOINT=sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com \
  --env ELASTICACHE_PORT=6379 \
  --env SIMILARITY_THRESHOLD=0.80 \
  --env EMBEDDING_MODEL=amazon.titan-embed-text-v2:0 \
  --env AWS_REGION=us-east-2
```

**CLI Reference**: https://github.com/aws/bedrock-agentcore-starter-toolkit/blob/main/documentation/docs/api-reference/cli.md#configure

### EC2 Jump Host (to be eliminated in Task 9-10)
- **IP**: `18.188.179.63` (dynamic - changes on restart)
- **Key**: `semantic-cache-demo-key.pem`
- **Current uses**: index creation, agentcore config/deploy, cache reset

### VPC Endpoints
- CloudWatch Logs, Bedrock Runtime, ECR API, ECR DKR (Interface)
- S3 (Gateway)
- Cost: ~$30/month

## Key Directories
- `agents/`: Python agents (entrypoint.py, support_agent.py, order_tracking_agent.py)
- `infrastructure/cloudformation/`: 5 CF/SAM templates (to be consolidated)
- `lambda/ramp_up_simulator/`: Go-based traffic generator
- `scripts/`: Deployment scripts (to be simplified)

## Important Lessons Learned

### Semantic Cache Performance
- Cache Hit: ~115ms | Cache Miss: 5-15 seconds
- 0.80 similarity threshold captures paraphrased queries effectively
- 50 base questions prime cache in first 30s, 450 variations test hits

### Throughput Limits
| Factor | Limit |
|--------|-------|
| AgentCore TPS | 25 per agent |
| Active Sessions | 500 concurrent |
| AWS SDK Rate Limiter | Built-in retry quota |

Effective throughput: ~5-6 RPS. Throttling starts at RPS 3-5.

### AgentCore VPC Mode
- Requires VPC endpoints for AWS service access
- Security group must allow outbound HTTPS (443)

### Titan Embeddings
- Use 1024 dimensions (not 1536)
- Must match vector index dimension exactly

## AWS Profile
- **Profile Name**: `semantic-cache-demo`
- **Region**: `us-east-2`
- **Account ID**: `507286591552`
