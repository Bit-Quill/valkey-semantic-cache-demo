# Retail Support Desk - Semantic Caching Demo Script

**Total Duration**: ~5 minutes  
**Audience**: Developers, Solutions Architects, business decision makers  
**Format**: Pre-recorded with fast-forward during simulation (3-4x speed)

---

## Pre-Demo Checklist

- [ ] Demo UI open in browser: `frontend/index.html` (or hosted URL)
- [ ] CloudWatch Dashboard open: `semantic-cache-demo` (set to **15-minute window**)
- [ ] Code editor with `agents/` directory open
- [ ] Cache reset completed (click "Reset Cache" in UI, verify metrics show zeros)

---

## Part 1: The Problem (0:00 - 0:45)

### Opening

> "Imagine it's Black Friday. Your AI-powered customer support is handling thousands of questions per minute. Customers are asking similar things: 'Where's my order?', 'What's my delivery status?', 'When will my package arrive?'"

> "Each question costs money - every call to the AI model has a price. And customers are waiting 5-10 seconds for each response."

### The Challenge

> "Here's the problem: **many of these questions are essentially the same**, just worded differently. But without smart caching, you're paying full price and full latency for every single one."

---

## Part 2: The Solution (0:45 - 1:15)

### Semantic Caching Explained

> "What if your system could recognize that 'Where's my package?' and 'Can you track my order?' are asking the same thing?"

> "That's semantic caching. Instead of matching exact words, we match **meaning**. When a similar question comes in, we return the cached answer instantly - no AI call needed."

### Show Architecture Diagram (briefly)

> "Here's how it works:"
> 1. "Customer question comes in"
> 2. "We check: have we seen something similar before?"
> 3. "If yes - instant response from cache, under 100 milliseconds"
> 4. "If no - we call the AI, get the answer, and cache it for next time"

> "The semantic matching happens in ElastiCache with Valkey - it understands the **meaning** of questions using vector search."

---

## Part 3: Infrastructure & Deployment (1:15 - 1:45)

### Single-Command Deployment

> "This entire demo is reproducible with a single command."

```bash
./deploy.sh --all
```

> "This deploys 8 CloudFormation/SAM stacks: VPC infrastructure, ElastiCache cluster, AgentCore IAM roles, CodeBuild for agent deployment, CloudWatch dashboard, cache management Lambda, traffic simulator, and the demo UI API."

> "Everything is infrastructure-as-code. Clone the repo, run one command, and you have the full demo running in your account."

---

## Part 4: Code Walkthrough (1:45 - 3:00)

### 4.1 Vector Index Creation

Open `infrastructure/elasticache_config/create_vector_index.py`:

```python
FT.CREATE idx:requests ON HASH PREFIX 1 request:vector:
SCHEMA
    embedding VECTOR HNSW 10 TYPE FLOAT32 DIM 1024 DISTANCE_METRIC COSINE
```

> "This creates a vector index in ElastiCache. HNSW is the algorithm - it enables fast similarity search. The key number is 1024 dimensions - that's the size of our embeddings."

### 4.2 Embedding Generation

Open `agents/entrypoint.py`, show `generate_embedding()` (~line 85):

```python
response = bedrock.invoke_model(
    modelId="amazon.titan-embed-text-v2:0",
    body=json.dumps({"inputText": text, "dimensions": EMBEDDING_DIM})  # 1024
)
```

> "When a question comes in, we convert it to a 1024-dimensional vector using Titan Embeddings. This vector captures the **meaning** of the question - similar questions produce similar vectors."

### 4.3 Cache Lookup

Show `search_similar_request()` (~line 110):

```python
FT.SEARCH idx:requests "*=>[KNN 1 @embedding $query_vec AS score]"
```

> "We search the index for the nearest neighbor - the most similar cached question. The score tells us how close the match is."

### 4.4 The Decision Point

Show the key `if` statement in `invoke()` (~line 230):

```python
if cache_request_id and similarity >= SIMILARITY_THRESHOLD:  # 0.80
    cached = get_cached_response(cache_request_id)
    if cached:
        # Cache HIT - return instantly
        emit_metrics(cached=True, latency_ms=latency, cost_avoided=cost_avoided)
        return cached["response_text"]

# Cache MISS - invoke full agent chain (expensive)
response = support_agent(request_text)
cache_response(request_text, response, embedding)
```

> "This is where the magic happens. If similarity exceeds our threshold, we return the cached response in milliseconds. Otherwise, we invoke the full multi-agent chain - SupportAgent, potentially OrderTrackingAgent - which takes 5-10 seconds and costs money."

---

## Part 5: Live Demo (3:00 - 4:30)

### Reset and Prepare (3:00)

In the Demo UI:

1. Click **Reset Cache**
2. Verify all metrics show zero

> "Starting fresh - empty cache."

### Start the Simulation (3:10)

Click **Start Demo**

> "This triggers a traffic simulation - about 1,000 customer questions over 3 minutes, ramping from 1 to 11 requests per second."

### Watch the Metrics [FAST FORWARD x3-4] (3:10 - 4:15)

*[Recording note: Fast-forward through the 3-minute simulation, narrate over the sped-up footage]*

Point to each KPI card as it updates:

**Cache Hit Rate**
> "Watch the hit rate climb as the cache warms up. It starts at zero, then rises as similar questions start matching cached responses."

**Avg Latency**
> "Cached responses come back in about 100 milliseconds - compared to 5-10 seconds for a full AI call."

**Cost Reduction**
> "This shows the percentage of AI costs we're avoiding through caching."

**Total Requests**
> "The count of successfully processed requests."

### Narrate Key Moments

> "First 30 seconds - we're priming the cache with base questions, so hit rate is low."

> "Now variations are coming in - the cache recognizes them as similar. Hit rate climbing..."

> "We're seeing [X]% of requests served from cache - that's [X]% of AI calls we didn't have to make."

---

## Part 6: Results & Takeaways (4:30 - 5:15)

### Summarize the Numbers

> "Here's what we achieved:"
> - "**Cache Hit Rate**: [X]% of questions answered from cache"
> - "**Latency**: ~100ms cached vs 5-10 seconds uncached - 50-100x faster"
> - "**Cost Reduction**: [X]% savings on AI inference costs"

### Business Impact

> "For production workloads, this means:"
> - "**Faster customer experience** - instant responses for common questions"
> - "**Lower costs** - pay only for unique questions"
> - "**Better scalability** - cache absorbs traffic spikes"

### Closing

> "Semantic caching with ElastiCache Valkey lets you handle AI workloads at scale - faster responses, lower costs, and the ability to handle traffic surges like Black Friday."

---

## Q&A Talking Points

**Q: How does it know questions are similar?**
> "We use Titan Embeddings to convert questions into 1024-dimensional vectors. Similar meanings produce vectors that are close together in that space. We measure closeness using cosine similarity."

**Q: What about accuracy? Will it return wrong answers?**
> "We set a similarity threshold at 0.80. Only questions that are truly similar get cached responses. If there's any doubt, it goes to the full AI chain."

**Q: What does this cost to run?**
> "The ElastiCache cluster costs about $38/month. The AI cost savings typically exceed that quickly under real traffic."

**Q: Can this work with other AI models?**
> "Yes - the cache layer is model-agnostic. We use Claude via Bedrock here, but any embedding model + LLM combination works."

**Q: Why are there some failures in the simulation?**
> "AgentCore has a 25 TPS limit per agent. At peak load (11 RPS), some requests get throttled. The recommended solution is horizontal scaling - deploy multiple AgentCore runtimes behind an Application Load Balancer. ALB supports WebSocket connections that AgentCore uses. With two runtimes, you'd have 50 TPS capacity."

---

## Fallback Plan

| Issue | Quick Fix |
|-------|-----------|
| UI not updating | Refresh browser, check API URL |
| Metrics stay at zero | Wait 1-2 minutes for CloudWatch delay |
| Demo button unresponsive | Use CloudWatch Dashboard as backup |

**Emergency**: Keep screenshots of a successful run as backup.

---

## Timing Summary

| Part | Start | Duration | Content |
|------|-------|----------|---------|
| 1. The Problem | 0:00 | 45s | Black Friday scenario, cost/latency challenge |
| 2. The Solution | 0:45 | 30s | Semantic caching concept, architecture |
| 3. Infrastructure | 1:15 | 30s | Single-command deployment, CloudFormation |
| 4. Code Walkthrough | 1:45 | 75s | Index, embeddings, lookup, decision logic |
| 5. Live Demo | 3:00 | 90s | UI demo with fast-forward |
| 6. Results | 4:30 | 45s | Summary, business impact, closing |
| **Total** | | **~5:15** | |

---

## Post-Demo

Click **Reset Cache** in the UI to prepare for the next demo.
