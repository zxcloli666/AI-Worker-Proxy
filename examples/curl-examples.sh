#!/bin/bash

# Example cURL commands for AI Worker Proxy

PROXY_URL="https://your-worker.workers.dev/v1/chat/completions"
AUTH_TOKEN="your-secret-proxy-token-here"

echo "=== AI Worker Proxy - cURL Examples ==="
echo

# Example 1: Health check
echo "1. Health check (no auth required)"
curl -X GET "https://your-worker.workers.dev/health"
echo -e "\n"

# Example 2: Simple non-streaming request with "fast" model
echo "2. Simple chat completion with 'fast' model"
curl -X POST "${PROXY_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "stream": false
  }'
echo -e "\n"

# Example 3: Streaming request with "deep-think" model
echo "3. Streaming response with 'deep-think' model"
curl -X POST "${PROXY_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "model": "deep-think",
    "messages": [
      {"role": "user", "content": "Count from 1 to 5"}
    ],
    "stream": true
  }' \
  --no-buffer
echo -e "\n"

# Example 4: With system message and parameters
echo "4. With system message and parameters"
curl -X POST "${PROXY_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "model": "deep-think",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Tell me a joke"}
    ],
    "temperature": 0.7,
    "max_tokens": 100,
    "stream": false
  }'
echo -e "\n"

# Example 5: Function calling with "deep-think" model
echo "5. Function calling / Tools"
curl -X POST "${PROXY_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "model": "deep-think",
    "messages": [
      {"role": "user", "content": "What is the weather in Paris?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get current weather in a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City name"
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
    ],
    "stream": false
  }'
echo -e "\n"

# Example 6: Multi-turn conversation with "fast" model
echo "6. Multi-turn conversation"
curl -X POST "${PROXY_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Nice to meet you, Alice! How can I help you today?"},
      {"role": "user", "content": "What is my name?"}
    ],
    "stream": false
  }'
echo -e "\n"

# Example 7: Using "nvidia" model (OpenAI-compatible provider)
echo "7. Using NVIDIA model"
curl -X POST "${PROXY_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "model": "nvidia",
    "messages": [
      {"role": "user", "content": "Explain quantum computing in simple terms"}
    ],
    "stream": false
  }'
echo -e "\n"

echo "=== Examples complete ==="
