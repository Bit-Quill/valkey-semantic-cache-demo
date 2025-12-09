import os
import time
import uuid
import json
import struct
from typing import cast
import boto3
from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
from bedrock_agentcore import BedrockAgentCoreApp
from glide_sync import (
    FtSearchLimit,
    FtSearchOptions,
    GlideClient,
    GlideClientConfiguration,
    NodeAddress,
    ReturnField,
)
from glide_sync.sync_commands import ft
from cache_constants import INDEX_NAME, KEY_PREFIX_REQUEST_RESPONSE, KEY_PREFIX_VECTOR

app = BedrockAgentCoreApp()

ELASTICACHE_ENDPOINT = os.environ.get("ELASTICACHE_ENDPOINT", "localhost")
ELASTICACHE_PORT = int(os.environ.get("ELASTICACHE_PORT", "6379"))
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.85"))
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "amazon.titan-embed-text-v2:0")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-2")

# This is the serverless runtime for running Titan Embeddings only - not to
# confuse with Bedrock AgentCore runtime
bedrock_runtime = cast(
    BedrockRuntimeClient, boto3.client("bedrock-runtime", region_name=AWS_REGION)
)

# Lazy-load cache client to prevent startup failures if ElastiCache is unreachable
_cache_client = None

def get_cache_client():
    """Get or create the cache client connection."""
    global _cache_client
    if _cache_client is None:
        config = GlideClientConfiguration(
            addresses=[NodeAddress(host=ELASTICACHE_ENDPOINT, port=ELASTICACHE_PORT)],
            client_name="semantic-cache-entrypoint",
        )
        _cache_client = GlideClient.create(config)
    return _cache_client


def generate_embedding(text: str) -> list[float]:
    """Generate Titan embeddings for the passed in text parameter."""
    response = bedrock_runtime.invoke_model(
        modelId=EMBEDDING_MODEL,
        body=json.dumps({"inputText": text, "dimensions": 1536}),
    )
    return json.loads(response["body"].read())["embedding"]


def search_cache(embedding: list[float], k: int = 1) -> tuple[str | None, float]:
    """Search vector index for similar cached requests. Returns (request_id, store)."""

    # Convert embedding to bytes (float32 binary format)
    embedding_bytes = struct.pack(f'{len(embedding)}f', *embedding)

    # KNN (K-nearest neighbors) query with vector parameter
    query = f"*=>[KNN {k} @embedding $vec AS score]"

    options = FtSearchOptions(
        params={"vec": embedding_bytes},
        return_fields=[
            ReturnField(field_identifier="request_id"),
            ReturnField(field_identifier="score"),
        ],
        limit=FtSearchLimit(offset=0, count=1),
    )
    result = ft.search(get_cache_client(), INDEX_NAME, query, options)

    # since result is [count, {doc_key: {field: value}}]
    if (
        isinstance(result, list)
        and len(result) > 1
        and isinstance(result[0], int)
        and result[0] > 0
    ):
        # get the first result only
        doc_data = list(result[1].values())[0]  # type: ignore[union-attr]
        request_id = doc_data[b"request_id"].decode()  # type: ignore[union-attr]
        distance = float(doc_data[b"score"])
        similarity = 1.0 - distance  # Convert distance to similarity
        return request_id, similarity

    return None, 0.0


def get_cached_response(request_id: str) -> dict | None:
    """Retrieve cached response by request_id"""
    key = f"{KEY_PREFIX_REQUEST_RESPONSE}{request_id}"
    result = get_cache_client().hgetall(key)
    if result:
        return {k.decode(): v.decode() for k, v in result.items()}
    return None


def cache_response(request_text: str, response_text: str, embedding: list[float]):
    f"""
    Store request-response pair with embedding.

    This stores both the embeding in {INDEX_NAME}
    and the request-response pair.
    """
    request_id = str(uuid.uuid4())
    vector_key = f"{KEY_PREFIX_VECTOR}{request_id}"
    rr_key = f"{KEY_PREFIX_REQUEST_RESPONSE}{request_id}"

    client = get_cache_client()
    
    # Convert embedding to binary format (float32)
    embedding_bytes = struct.pack(f'{len(embedding)}f', *embedding)
    
    client.hset(
        vector_key,
        {
            "request_id": request_id,
            "embedding": embedding_bytes,
            "timestamp": str(time.time()),
        },
    )

    client.hset(
        rr_key,
        {
            "request_text": request_text,
            "response_text": response_text,
            "created_at": str(time.time()),
        },
    )


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
        - Return cached response immediately
        - Emit metrics to CloudWatch: latency, cost savings, match score
    4. On cache miss:
        - Forward request to Support Agent via framework
        - Cache response with embedding for future queries
        - Emit metrics to CloudWatch: latency, tokens consumed, cost

    Args:
        request: Incoming customer support request containing request_text

    Returns:
        str: Response text (cached or from agent)
    """
    start_time = time.time()
    request_text = request.get("request_text", "")

    embedding = generate_embedding(request_text)
    cache_request_id, similarity = search_cache(embedding)

    if cache_request_id and similarity >= SIMILARITY_THRESHOLD:
        cached = get_cached_response(cache_request_id)
        if cached:
            latency = (time.time() - start_time) * 1000
            print(
                f"CACHE HIT: similarity={similarity:.3f}, latency={latency:.0f}ms, request_id={cache_request_id}"
            )
            return {
                "response": cached["response_text"],
                "cached": True,
                "similarity": similarity,
            }

    print(f"CACHE MISS: similarity={similarity:.3f}, forwarding to SupportAgent")
    response_text = "This is a placeholder response for SupportAgent"

    cache_response(request_text, response_text, embedding)
    latency = (time.time() - start_time) * 1000
    print(f"Response cached, total latency={latency:.0f}ms")

    return {"response": response_text, "cached": False}


if __name__ == "__main__":
    app.run()
