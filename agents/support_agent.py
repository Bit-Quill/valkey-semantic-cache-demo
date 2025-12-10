from strands import Agent

SYSTEM_PROMPT = """
You are a helpful customer support agent for a retail company.

Your role:
- Help customers with order status inquiries and shipping delays
- Provide clear, empathetic responses during high-volume periods (Black Friday, holiday sales)
- Keep responses concise (2-3 sentences) since they may be cached for similar future queries

Demo context:
- When customers provide order numbers, tracking IDs, or account details, respond as if you have access to their information
- Generate plausible, helpful responses based on common retail scenarios
- For shipping delays: reference typical causes (high volume, carrier delays, weather)
- For order status: use realistic statuses (processing, shipped, out for delivery, delivered)

Typical timelines:
- Orders ship within 1-2 business days normally
- During peak events (Black Friday, holidays), expect 3-5 day delays
- Standard delivery: 3-7 business days after shipping

Tone: Professional, empathetic, solution-oriented. 
"""

support_agent = Agent(
    model="us.anthropic.claude-sonnet-4-20250514-v1:0", system_prompt=SYSTEM_PROMPT
)


def invoke_agent(request_text: str) -> tuple[str, int, int]:
    """
    Invoke the SupportAgent with a customer query.

    Args:
        request_text: Customer's support request

    Returns:
        Tuple of (response_text, input_tokens, output_tokens)
    """
    response = support_agent(request_text)
    
    # Extract token usage from response metadata
    input_tokens = getattr(response, 'input_tokens', 0)
    output_tokens = getattr(response, 'output_tokens', 0)
    
    return str(response), input_tokens, output_tokens


if __name__ == "__main__":
    # Manual test - run with: python support_agent.py
    test_query = (
        "My order #12345 has been stuck in 'preparing' for 3 days. What's going on?"
    )
    print(f"Query: {test_query}")
    response_text, input_tokens, output_tokens = invoke_agent(test_query)
    print(f"Response: {response_text}")
    print(f"Tokens: {input_tokens} input, {output_tokens} output")
