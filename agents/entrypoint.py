from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(request):
    """
    Main entrypoint for retail support desk system.

    Orchestrates all incoming customer support requests, leveraging semantic
    caching via Titan embeddings and ElastiCache to optimize response times
    and reduce LLM consts during traffic spikes.
    """
    print(f"Hello, {request.get('name')}!")


if __name__ == "__main__":
    app.run()
