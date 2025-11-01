import { OpenAIChatResponse, OpenAIMessage } from '../types';

export function createOpenAIResponse(
  content: string,
  model: string,
  finishReason: 'stop' | 'length' | 'tool_calls' = 'stop',
  toolCalls?: any[]
): OpenAIChatResponse {
  const message: OpenAIMessage = {
    role: 'assistant',
    content: toolCalls ? null : content,
  };

  if (toolCalls && toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    id: `chatcmpl-${generateId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason,
      },
    ],
  };
}

export function createStreamChunk(
  delta: Partial<OpenAIMessage>,
  model: string,
  finishReason: 'stop' | 'length' | 'tool_calls' | null = null
): string {
  const chunk = {
    id: `chatcmpl-${generateId()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason,
      },
    ],
  };

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export function generateId(length: number = 29): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
