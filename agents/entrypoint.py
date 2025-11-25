from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(request):
    """
    Main entrypoint for retail support desk system.

    Orchestrates all incoming customer support requests, leveraging semantic
    caching via Titan embeddings and ElastiCache to optimize response times
    and reduce LLM consts during traffic spikes.

    Flow:
    1. Generate 1536-dimensional embedding for incoming request using Titan
    2. Query ElastiCache (Valkey) vector index with HNSW algorithm
    3. On cache hit (0.85 similarity):
        - Emit metrics to CloudWatch: latency, cost savings, match score
    4. On cache miss:
        - Forward request to Support Agent via framework
        - Cache response with embedding for future queries
        - Emit metrics to CloudWatch: latency, tokens consumed, cost

    Args:
        request: Incoming customer support request containing request_text,
            request_id, timestamp, and cache_enabled flag

    Returns:
        None - Metrics emitted to CloudWatch; response handled by framework
    """
    print(f"Hello, {request.get('name')}!")


if __name__ == "__main__":
    app.run()
