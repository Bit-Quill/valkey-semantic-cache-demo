# Retail Support Desk - Semantic Caching Demo

An AI-powered retail customer support system demonstrating measurable cost and performance benefits through semantic caching with ElastiCache (Valkey), AWS Bedrock AgentCore, and multi-agent orchestration.

## 🎯 Project Goals

This application provides developers and AWS customers with a concrete, measurable demonstration of cost and performance benefits achievable through semantic caching in AI applications. The demo serves as a reference implementation showcasing how ElastiCache's vector search capabilities combined with Titan embeddings enable intelligent response caching in a modern multi-agent application deployed on Bedrock AgentCore.

**Key Demonstrations:**

- Handling request surges during peak sales events (e.g., Black Friday)
- Reducing response latency from seconds to milliseconds through semantic caching
- Cutting LLM token costs by avoiding redundant agent calls
- Multi-agent orchestration using AWS Bedrock AgentCore and Strands framework
- Real-time metrics visualization via CloudWatch Dashboard

## ✨ Key Features

- **Semantic Caching**: Uses Titan embeddings with HNSW algorithm (0.85 similarity threshold) to identify semantically similar requests
- **Multi-Agent Architecture**: SupportAgent orchestrates with OrderTrackingAgent using Strands framework
- **Intelligent Cache Layer**: @entrypoint intercepts requests before agent invocation, returning cached responses in <100ms
- **Agent Tooling**: OrderTrackingAgent uses decorated tools to check order status and delivery information
- **Real-time Metrics**: CloudWatch Dashboard visualizes latency reduction, cost savings, cache efficiency, and match scores
- **Traffic Simulation**: Lambda-based ramp-up simulator mimics incident spikes (1 → 100 requests/second)
- **Conference-Ready**: Live metrics suitable for projection, optional cache reset between demos

## 🏗️ Architecture

![Architecture Diagram](./semantic_support_desk_arch.png)

### Data Flow

1. **Client** initiates request via **API Gateway** to **Ramp-up Simulator** (Lambda)
2. **Lambda** gradually increases throughput (1 → 100 requests/second over 30 seconds)
3. **@entrypoint** generates Titan embedding and queries **ElastiCache** vector index
4. **Cache Hit (≥0.85 similarity)**:
   - Returns cached response immediately (<100ms)
   - Logs metrics: latency, avoided cost, match score
5. **Cache Miss**:
   - Forwards to **SupportAgent** (Claude Sonnet 4.0)
   - **SupportAgent** analyzes request, consults **OrderTrackingAgent** if needed
   - **OrderTrackingAgent** uses `@tool` decorated functions to check order status
   - Response returned to **@entrypoint**, cached with embedding
6. **CloudWatch** receives metrics for all requests (cache hits/misses, latency, costs)
7. **Dashboard** visualizes cumulative effectiveness in real-time

## 🚀 Quick Start

### Prerequisites

- AWS Account with Bedrock access (Sonnet 4.0, Sonnet 3.5, Titan Embeddings)
- AWS Lambda execution role with permissions for Bedrock, ElastiCache, CloudWatch
- ElastiCache (Valkey) cluster configured
- AWS CLI configured with appropriate credentials
- Python 3.11+ (for Strands agents) or Node.js 20+ (depending on implementation choice)

### Running the Application

1. **Clone the repository**

```bash
   git clone https://github.com/vasigorc/valkey-semantic-cache-demo.git
   cd valkey-semantic-cache-demo
```

2. **Set up AWS credentials**

```bash
   # in ~/.aws/credentials
   [default]
   aws_access_key_id=your_key
   aws_secret_access_key=your_secret
   aws_region=us-east-1
```

3. **Trigger simulation via Web Console or CLI**

```bash
   # Via AWS CLI
   aws lambda invoke \
     --function-name RampUpSimulator \
     --payload '{"cache_enabled": true}' \
     response.json
```

4. **View metrics**

   Navigate to CloudWatch Dashboard in AWS Console to observe:

   - Average latency reduction
   - Bedrock cost savings
   - Cache hit ratio
   - Match score distribution

### Resetting the Demo

For conference presentations, reset the cache between runs:

```bash
aws lambda invoke \
  --function-name CacheResetLambda \
  --payload '{"action": "flush"}' \
  reset-response.json
```

## 🛠️ Tech Stack

### Core Infrastructure

- **AWS Bedrock AgentCore**: Multi-agent runtime with Strands framework
- **AWS Lambda**: Serverless compute for simulation and cache management
- **API Gateway**: HTTP endpoint for client requests
- **ElastiCache (Valkey)**: Vector database with HNSW indexing
- **CloudWatch**: Metrics aggregation and dashboard visualization

### AI Components

- **Claude Sonnet 4.0**: Primary SupportAgent for complex query analysis
- **Claude Sonnet 3.5**: OrderTrackingAgent for lightweight tool invocations
- **Titan Embeddings**: Generate 1536-dimensional vectors for semantic search
- **Strands Framework**: Agent orchestration, @entrypoint and @tool decorators

### Development

- **Python 3.11+**: Primary language for Strands agents (or Node.js/TypeScript for alternative implementation)
- **Conventional Commits**: Git commit message format
- **CloudFormation/SAM**: Infrastructure as Code (when applicable)

## 📊 Data Structure

### Vector Index (Semantic Search)

```
Key: request:vector:{uuid}
Fields:
  - request_id (TAG)
  - embedding (VECTOR HNSW, 1536 dimensions)
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

## 🗺️ Project Timeline

### Task 1: Foundation ✅

- [ ] AWS account setup and Bedrock access verification
- [ ] IAM role configuration (Lambda, Bedrock, ElastiCache, CloudWatch)
- [x] Repository structure and collaboration workflow
- [x] Architecture document and technical narrative

### Task 2: ElastiCache Integration (In Progress)

- [ ] ElastiCache (Valkey) cluster provisioning
- [ ] Vector index schema creation (HNSW, 1536 dimensions)
- [ ] @entrypoint implementation in AgentCore
- [ ] Titan Embeddings integration for semantic search
- [ ] Basic cache hit/miss logic

### Task 3: SupportAgent Integration

- [ ] SupportAgent deployment on AgentCore
- [ ] System prompt design for retail support context
- [ ] Integration with @entrypoint for cache misses
- [ ] End-to-end test: cache miss → SupportAgent → cache write

### Task 4: CloudWatch Integration

- [ ] Metrics emission from @entrypoint (latency, cost, hit ratio)
- [ ] CloudWatch custom metric definitions
- [ ] Dashboard creation with real-time visualization
- [ ] Alerts configuration (optional)

### Task 5: Multi-Agent Scenario

- [ ] OrderTrackingAgent deployment (Sonnet 3.5)
- [ ] @tool decorator implementation for order status checks
- [ ] Agent orchestration: SupportAgent → OrderTrackingAgent
- [ ] Tool invocation testing and validation

### Task 6: Integration & Testing

- [ ] End-to-end flow validation
- [ ] Error handling (network failures, tool errors, agent timeouts)
- [ ] Performance optimization
- [ ] Seed data creation (sample requests)

### Task 7: Simulation & Presentation Layer

- [ ] Ramp-up Lambda implementation (1 → 100 requests/second)
- [ ] API Gateway configuration
- [ ] Client interface (Web Console or CLI)
- [ ] Cache reset Lambda
- [ ] Demo script and walkthrough

## 🎪 Conference Demo Flow

1. **Fresh Start**: Invoke CacheResetLambda, show CloudWatch Dashboard (all metrics at zero)
2. **First Request**: "My order stays in preparing for three days"
   - Cache miss → Full agent chain (SupportAgent → OrderTrackingAgent)
   - Dashboard shows: ~2.5s latency, ~$0.003 cost
3. **Ramp-up Simulation**: Trigger Lambda with 30-second ramp (1 → 100 req/s)
   - Subsequent similar requests ("I bought a present but you haven't shipped it yet!")
   - Dashboard shows: Rising cache hit ratio, dropping average latency
4. **Steady State**: After 50+ requests
   - Cache hit ratio: 85-90%
   - Average latency: <150ms
   - Cost savings: ~$0.10 accumulated
5. **Semantic Match Demonstration**: "Tracking number reads labelled for shipper, no change after 5 days"
   - Cache hit with 0.88 similarity score
   - Response time: <100ms
6. **Reset**: Clear cache to demonstrate again if needed

## 📝 Configuration

### Environment Variables

**AgentCore / Lambda**

```env
AWS_REGION=us-east-1
ELASTICACHE_ENDPOINT=your-cluster.cache.amazonaws.com:6379
BEDROCK_SUPPORT_AGENT_MODEL=anthropic.claude-sonnet-4-20250514
BEDROCK_TRACKING_AGENT_MODEL=anthropic.claude-sonnet-3-5-v2
EMBEDDING_MODEL=amazon.titan-embed-text-v1
SIMILARITY_THRESHOLD=0.85
CLOUDWATCH_NAMESPACE=SemanticSupportDesk
```

**Simulation Parameters**

```env
RAMP_START_RPS=1
RAMP_END_RPS=100
RAMP_DURATION_SECONDS=30
REQUEST_TEMPLATES_PATH=./templates/requests.json
```

## 🤝 Development Principles

- **Incremental Progress**: Small, testable steps with frequent Git commits
- **Conventional Commits**: Structured commit messages (feat:, fix:, docs:)
- **Red → Green → Refactor**: TDD approach for cacheable business logic
- **Error Handling First**: No silent failures, comprehensive logging
- **Progress Tracking**: Maintained via `Progress.md` at repository root
- **Immediate Error Resolution**: Stop and fix blockers before proceeding

## 📦 Project Structure

```
valkey-semantic-cache-demo/
├── README.md
├── Progress.md
├── semantic_support_desk_arch.png  # Architecture diagram
├── agents/
│   ├── support_agent.py            # Main SupportAgent
│   ├── order_tracking_agent.py     # OrderTrackingAgent with @tool decorators
│   └── entrypoint.py               # @entrypoint with caching logic
├── lambda/
│   ├── ramp_up_simulator/          # Traffic simulation Lambda
│   └── cache_reset/                # Cache management Lambda
├── infrastructure/
│   ├── cloudformation/             # Infrastructure as Code
│   └── elasticache_config/         # Valkey cluster configuration
├── templates/
│   └── requests.json               # Sample request templates for simulation
├── scripts/
│   ├── deploy.sh                   # Deployment automation
│   └── reset-demo.sh               # Demo reset script
└── tests/
    └─ unit/                       # Unit tests for agents
```

## 🐛 Troubleshooting

### ElastiCache Connection Fails

- Verify VPC security groups allow traffic from Lambda
- Check ElastiCache cluster status in AWS Console
- Review Lambda CloudWatch logs for connection errors

### AgentCore Agent Invocation Errors

- Confirm Bedrock model access in IAM permissions
- Verify model IDs match available Bedrock models in region
- Check Lambda timeout settings (increase if needed for agent chains)

### Metrics Not Appearing in CloudWatch

- Ensure CloudWatch PutMetricData permissions in Lambda role
- Verify custom namespace matches Dashboard configuration
- Check for rate limiting on CloudWatch API calls

### Cache Hit Ratio Lower Than Expected

- Review similarity threshold (may need adjustment < 0.85)
- Examine request diversity in simulation templates
- Verify embeddings are being generated correctly
