# Local Development Guide

This guide covers running the complete semantic cache demo locally.

## Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) package manager
- Go 1.21+ (for ramp-up simulator)
- AWS CLI configured with `semantic-cache-demo` profile
- Docker Desktop running

## Local Demo Setup

### 1. Start Local Valkey

```bash
docker run -d --name valkey -p 6379:6379 valkey/valkey-bundle:latest
```

### 2. Create Vector Index

```bash
cd agents
source .venv/bin/activate
uv run python ../infrastructure/elasticache_config/create_vector_index.py
```

### 3. Deploy CloudWatch Dashboard

```bash
./scripts/deploy-cloudwatch-dashboard.sh
```

### 4. Configure Environment

```bash
export AWS_PROFILE=semantic-cache-demo
export AWS_REGION=us-east-2
export EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
```

### 5. Generate requirements.txt

```bash
cd agents
uv pip compile pyproject.toml -o requirements.txt
```

### 6. Configure AgentCore

```bash
agentcore configure -e entrypoint.py -n entrypoint -rf requirements.txt -dt direct_code_deploy -rt PYTHON_3_12 --disable-memory --non-interactive
```

### 7. Launch AgentCore (Terminal 1)

```bash
cd agents
export AWS_PROFILE=semantic-cache-demo
export EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
agentcore launch --local
```

Runs at `http://localhost:8080`.

### 8. Start Ramp-Up Simulator Server (Terminal 2)

```bash
cd lambda/ramp_up_simulator
export AWS_PROFILE=semantic-cache-demo
go run .
```

Runs at `http://localhost:8081`. Endpoints:
- `POST /start` - triggers simulation
- `POST /reset` - flushes local Valkey cache

### 9. Open Demo UI

```bash
open local-env/index.html
```

Click **Start Demo** to trigger the simulation. Metrics update from CloudWatch.

---

## Troubleshooting

### AccessDeniedException on InvokeModel

Ensure `AWS_PROFILE=semantic-cache-demo` is exported in both terminals.

### Invalid Model Identifier

Set `EMBEDDING_MODEL` before launching AgentCore:
```bash
export EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
```

### Cache always misses

Lower the similarity threshold:
```bash
export SIMILARITY_THRESHOLD=0.75
agentcore launch --local
```

---

## Environment Variables

| Variable               | Default                       | Description                  |
| ---------------------- | ----------------------------- | ---------------------------- |
| `ELASTICACHE_ENDPOINT` | `localhost`                   | Valkey host                  |
| `ELASTICACHE_PORT`     | `6379`                        | Valkey port                  |
| `SIMILARITY_THRESHOLD` | `0.80`                        | Min similarity for cache hit |
| `EMBEDDING_MODEL`      | `amazon.nova-embed-text-v1:0` | Bedrock embedding model      |
| `AWS_REGION`           | `us-east-2`                   | AWS region                   |
