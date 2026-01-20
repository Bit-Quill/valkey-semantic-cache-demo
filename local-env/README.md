# Local Environment

This directory contains files for local development and testing.

## Quick Start

### 1. Start SAM Local API

```bash
cd local-env
sam local start-api
```

This starts the API at `http://127.0.0.1:3000`.

### 2. Open the UI

Open `index.html` in your browser (or use a local server):

```bash
open index.html
# or
python3 -m http.server 8080
```

### 3. Test Endpoints

```bash
# Get metrics (reads from CloudWatch in the cloud)
curl http://127.0.0.1:3000/metrics

# Start demo (invokes cloud Lambda)
curl -X POST http://127.0.0.1:3000/start

# Reset cache (invokes cloud Lambda)
curl -X POST http://127.0.0.1:3000/reset
```

## Files

| File | Description |
|------|-------------|
| `index.html` | Demo UI pointing to SAM local endpoint |
| `template.yaml` | SAM template for local Lambda |
| `LOCAL_DEVELOPMENT.md` | Full local development guide for agents |
| `README.md` | This file |

## Notes

- Metrics are read from CloudWatch in the cloud (requires AWS credentials)
- Start/Reset buttons invoke the actual cloud Lambdas
- For fully local testing, see `LOCAL_DEVELOPMENT.md` for agent setup
