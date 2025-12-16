# Retail Support Desk - Semantic Caching Demo Script

**Total Duration**: ~5-6 minutes  
**Audience**: Developers, Solutions Architects, AWS customers interested in AI cost optimization

---

## Pre-Demo Checklist

### AWS Console Tabs (Open in Browser)

- [ ] Lambda Console → `semantic-cache-demo-ramp-up-simulator`
- [ ] CloudWatch Dashboard → `semantic-cache-demo` (set to **15-minute window**)
- [ ] CloudWatch Logs → `/aws/lambda/semantic-cache-demo-ramp-up-simulator`

### Terminal Sessions Ready

- [ ] SSH session to EC2 jump host:

  ```bash
  ssh -i ~/.ssh/semantic-cache-demo-key.pem ec2-user@18.221.90.67
  ```

### Verify & Reset

```bash
# On EC2 - run the reset script
./scripts/reset-cache.sh
```

### Files Ready

- [ ] Architecture diagram: `semantic_support_desk_arch.png`
- [ ] Code editor with project open

---

## Part 1: Introduction (0:00 - 0:30)

### Greeting

> "Hi, I'm Vasile from the ElastiCache/Valkey Agentic AI integration team. Today I'll show how semantic caching with ElastiCache Valkey dramatically reduces AI costs and latency for a retail support desk handling Black Friday-level traffic."

### Architecture Overview (Show Diagram)

Walk through quickly:

1. **Lambda Simulator** → generates realistic traffic (1→11 req/s over 3 minutes)
2. **@entrypoint** → generates Titan embedding, queries ElastiCache vector index
3. **Cache Hit** → returns cached response in ~100ms
4. **Cache Miss** → invokes SupportAgent (Claude Sonnet 4) → may delegate to OrderTrackingAgent → caches response
5. **CloudWatch** → real-time metrics visualization

> "Key point: this runs in VPC mode because ElastiCache doesn't support public endpoints. The EC2 jump host lets us access the cache for management."

---

## Part 2: Project Structure (0:30 - 1:00)

```
valkey-semantic-cache-demo/
├── agents/           # uv project - Python agents (Bedrock AgentCore + Strands framework)
├── lambda/           # Go-based traffic simulator
├── infrastructure/   # CloudFormation templates
└── scripts/          # Deployment automation
```

> "The agents directory is a uv project with the Strands framework. Lambda is Go for efficient concurrency. Infrastructure is all CloudFormation."

---

## Part 3: Code Walkthrough (1:00 - 2:00)

### 3.1 Entrypoint - Cache Decision Logic

Open `agents/entrypoint.py`, show the `invoke` function (~line 230):

```python
if cache_request_id and similarity >= SIMILARITY_THRESHOLD:
    cached = get_cached_response(cache_request_id)
    if cached:
        # Cache HIT - return in ~100ms
        emit_metrics(cached=True, latency_ms=latency, similarity=similarity, cost_avoided=cost_avoided)
        return cached["response_text"]
```

> "The threshold check happens here. If similarity exceeds 80%, we return the cached response and emit metrics to CloudWatch. Otherwise, we invoke the full agent chain."

### 3.2 Multi-Agent Orchestration

Open `agents/support_agent.py`:

```python
support_agent = Agent(
    model="us.anthropic.claude-sonnet-4-20250514-v1:0",
    tools=[lookup_order_tracking],
)
```

> "SupportAgent can delegate to OrderTrackingAgent via the lookup_order_tracking tool for order-specific queries."

### 3.3 Tool Decorators

Open `agents/order_tracking_agent.py`:

```python
@tool
def check_order_status(order_id: str) -> dict:
    """Check the current status of an order by order ID."""
```

> "The @tool decorator exposes functions to the agent - modular and testable."

---

## Part 4: Infrastructure (2:00 - 2:30)

### Show Stack Outputs (AWS CLI or Console)

```bash
# ElastiCache stack
export AWS_PROFILE=semantic-cache-demo

aws cloudformation describe-stacks --stack-name semantic-cache-demo-infrastructure \
  --query 'Stacks[0].Outputs' --output table --region us-east-2

# AgentCore stack
aws cloudformation describe-stacks --stack-name semantic-cache-demo-agentcore \
  --query 'Stacks[0].Outputs' --output table --region us-east-2
```

> "The ElastiCache stack provisions the Valkey cluster. The AgentCore stack creates IAM roles, ECR repository, S3 bucket, and VPC endpoints - without those endpoints, the agent couldn't reach ElastiCache or emit CloudWatch metrics from within the VPC."

### Vector Index Creation

```bash
# On EC2 - create HNSW index for semantic search
cd ~/valkey-semantic-cache-demo/agents
uv run python ../infrastructure/elasticache_config/create_vector_index.py
```

> "This creates the HNSW vector index with 1024 dimensions and cosine distance - the foundation for semantic similarity matching."

---

## Part 5: Deployment (2:30 - 3:00)

### AgentCore Configuration

On EC2, show the configuration command (Ctrl+R → `agentcore configure`, then Ctrl+X Ctrl+E to show full command).

Then show the network mode:

```bash
grep -A 5 "network_configuration" agents/.bedrock_agentcore.yaml
```

```yaml
network_configuration:
  network_mode: VPC # Required for ElastiCache access
```

> "VPC mode is required because ElastiCache doesn't support public endpoints."

### AgentCore Deploy

```bash
# Deploy agent with environment variables for cache connection
agentcore deploy \
  --env ELASTICACHE_ENDPOINT=sevoxy28zhyaiz6.xkacez.ng.0001.use2.cache.amazonaws.com \
  --env ELASTICACHE_PORT=6379 \
  --env SIMILARITY_THRESHOLD=0.80 \
  --env EMBEDDING_MODEL=amazon.titan-embed-text-v2:0 \
  --env AWS_REGION=us-east-2
```

### Lambda Deployment

```bash
# Build & deploy
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bootstrap main.go
sam deploy --template-file ramp-up-simulator.yaml --stack-name semantic-cache-demo-ramp-simulator
```

---

## Part 6: Live Demo (3:00 - 6:00)

### Start Simulation (3:00)

In Lambda Console:

1. Navigate to `semantic-cache-demo-ramp-up-simulator`
2. Click **Test** → empty payload `{}` → **Test**

> "This triggers a 3-minute ramp-up. While it runs, let me show you the code we just discussed in more detail..."

### During Run: Deeper Code Review (3:00 - 5:30)

Use this time to:

- Show more of `entrypoint.py` (embedding generation, vector search)
- Show `seed-questions.json` structure (50 base + 450 variations)
- Answer audience questions

### Check Logs Briefly (5:00)

Tail Lambda logs - show a few lines:

```
INFO: Sent request 150/990, successes: 89, failures: 61
```

> "Some failures are expected - AgentCore has a 25 TPS limit, and the AWS SDK rate limiter can exhaust its retry quota. These are known constraints, not cache issues."

### Confirm Completion (5:30)

Lambda output:

```json
{
  "total_requests": 990,
  "successes": 661,
  "failures": 329,
  "message": "Ramp-up complete: 661/990 successful"
}
```

### Analyze Dashboard (5:30 - 6:00)

Navigate to CloudWatch Dashboard:

1. **Latency** → "Cache hits: ~115ms. Misses: 5-15 seconds. 50-100x faster."
2. **Cache Hit Ratio** → "Starts at 0%, climbs to 95%+ as cache warms."
3. **Cost Savings** → "$1.49 saved in 3 minutes by avoiding redundant LLM calls."
4. **Similarity Scores** → "Most hits at 85-95% - semantically equivalent questions."

---

## Key Takeaways

> "Semantic caching addresses three challenges: **cost** (avoid redundant LLM calls), **latency** (100ms vs 5-15s), and **scalability** (cache absorbs repeated queries during traffic spikes)."

---

## Fallback Plan

| Issue                  | Quick Fix                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Lambda fails           | Check IAM: `aws lambda get-function-configuration --function-name semantic-cache-demo-ramp-up-simulator` |
| Cache connection fails | On EC2: `redis6-cli -h $CACHE_HOST PING`                                                                 |
| Metrics don't appear   | Verify namespace `SemanticSupportDesk`, wait 1-2 min delay                                               |
| Low hit ratio          | Cache not reset properly, or threshold needs adjustment                                                  |

**Emergency**: Keep screenshots of successful runs as backup.

---

## Q&A Preparation

**Q: Why 80% similarity threshold?**

> "Tested various values. 80% captures paraphrased questions while avoiding false positives."

**Q: What's the cache storage cost?**

> "ElastiCache t4g.small ~$38/month. LLM savings far exceed cache costs."

**Q: How do you handle cache invalidation?**

> "This demo uses TTL-based expiration. Production would add invalidation triggers when data changes."

**Q: Can this work with other LLMs?**

> "Yes, the cache layer is model-agnostic. We use Claude via AWS Bedrock for native integration, but any embedding model + LLM works."

**Q: What about multi-turn conversations?**

> "We deliberately excluded LTM/STM from this AgentCore runtime to focus on semantic caching. For conversations, strategies include chunking conversation context into the embedding, or using RAG with ElastiCache as the vector store for conversation history."

**Q: What are the throughput limits?**

> "AgentCore: 25 TPS per agent, 500 concurrent sessions. AWS SDK rate limiter also applies - it has a built-in retry quota that can exhaust under sustained load, causing 'failed to get rate limit token' errors. All limits adjustable via Service Quotas."

**Q: Why Go for Lambda instead of Python?**

> "Go's goroutines handle high-throughput simulation efficiently. Faster cold starts too."

**Q: How does HNSW compare to other algorithms?**

> "HNSW offers sub-millisecond queries with good recall. Trade-off: higher memory, slower index builds vs flat indexes."

---

## Timing Summary

| Part                 | Start | Duration   | Content                                        |
| -------------------- | ----- | ---------- | ---------------------------------------------- |
| 1. Introduction      | 0:00  | 30s        | Greeting, architecture overview                |
| 2. Project Structure | 0:30  | 30s        | Directory layout                               |
| 3. Code Walkthrough  | 1:00  | 60s        | entrypoint, agents, tools                      |
| 4. Infrastructure    | 2:00  | 30s        | Stack outputs                                  |
| 5. Deployment        | 2:30  | 30s        | AgentCore config, Lambda deploy                |
| 6. Live Demo         | 3:00  | 180s       | Start sim → code review during run → dashboard |
| **Total**            |       | **~6 min** |                                                |

---

## Post-Demo Reset

```bash
# On EC2 jump host
./scripts/reset-cache.sh
```
