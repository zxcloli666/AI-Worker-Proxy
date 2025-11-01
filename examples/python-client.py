"""
Example Python client using OpenAI SDK with AI Worker Proxy
"""

from openai import OpenAI

# Initialize client with proxy URL
# Note: Use the base worker URL, model name determines routing
client = OpenAI(
    base_url="https://your-worker.workers.dev/v1/chat/completions",
    api_key="your-secret-proxy-token-here"
)

# Example 1: Simple chat completion with "deep-think" model
print("Example 1: Simple chat completion")
response = client.chat.completions.create(
    model="deep-think",  # Model name determines which providers to use
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ]
)
print(response.choices[0].message.content)
print()

# Example 2: Streaming response with "fast" model
print("Example 2: Streaming response")
stream = client.chat.completions.create(
    model="fast",  # Uses different providers configured for "fast"
    messages=[
        {"role": "user", "content": "Write a short poem about AI."}
    ],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print("\n")

# Example 3: Function calling / Tools
print("Example 3: Function calling")
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"]
                    }
                },
                "required": ["location"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="deep-think",  # Tools work with any configured model
    messages=[
        {"role": "user", "content": "What's the weather like in Tokyo?"}
    ],
    tools=tools
)

# Check if the model wants to call a function
if response.choices[0].message.tool_calls:
    tool_call = response.choices[0].message.tool_calls[0]
    print(f"Function called: {tool_call.function.name}")
    print(f"Arguments: {tool_call.function.arguments}")

# Example 4: Using different model configurations
print("\nExample 4: Using different models")

# Use "nvidia" model (routes to NVIDIA AI)
response = client.chat.completions.create(
    model="nvidia",
    messages=[{"role": "user", "content": "Quick question: what is 2+2?"}]
)
print(f"NVIDIA model response: {response.choices[0].message.content}")

# Use "openai" model (routes to OpenAI)
response = client.chat.completions.create(
    model="openai",
    messages=[{"role": "user", "content": "Tell me a joke"}]
)
print(f"OpenAI model response: {response.choices[0].message.content}")
