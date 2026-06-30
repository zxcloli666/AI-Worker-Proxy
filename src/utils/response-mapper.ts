import { OpenAIChatResponse, OpenAIMessage, StreamToolCallDelta, ToolCall } from '../types';

export function generateId(length: number = 29): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function createOpenAIResponse(
  content: string,
  model: string,
  finishReason: 'stop' | 'length' | 'tool_calls' = 'stop',
  toolCalls?: ToolCall[]
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

/** Delta for a single stream chunk */
export interface StreamDelta {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: StreamToolCallDelta[];
}

/**
 * Manages a streaming session with a consistent ID across all chunks.
 * Use one StreamSession per request.
 */
export class StreamSession {
  readonly id: string;
  readonly created: number;
  private encoder = new TextEncoder();

  constructor(private model: string) {
    this.id = `chatcmpl-${generateId()}`;
    this.created = Math.floor(Date.now() / 1000);
  }

  /** Encode a delta into an SSE data line */
  chunk(
    delta: StreamDelta,
    finishReason: 'stop' | 'length' | 'tool_calls' | null = null
  ): Uint8Array {
    const payload = {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        {
          index: 0,
          delta,
          finish_reason: finishReason,
        },
      ],
    };
    return this.encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  /** The initial chunk that sets the assistant role */
  roleChunk(): Uint8Array {
    return this.chunk({ role: 'assistant', content: '' });
  }

  /** A content text chunk */
  textChunk(text: string): Uint8Array {
    return this.chunk({ content: text });
  }

  /**
   * Tool call initial chunk — sends id, type, name, and empty arguments.
   * Per OpenAI spec, each tool_call MUST have `index`.
   */
  toolCallStartChunk(index: number, callId: string, functionName: string): Uint8Array {
    return this.chunk({
      tool_calls: [
        {
          index,
          id: callId,
          type: 'function',
          function: { name: functionName, arguments: '' },
        },
      ],
    });
  }

  /** Incremental arguments chunk for an ongoing tool call */
  toolCallArgsChunk(index: number, args: string): Uint8Array {
    return this.chunk({
      tool_calls: [
        {
          index,
          function: { arguments: args },
        },
      ],
    });
  }

  /** Final chunk with finish_reason */
  finishChunk(reason: 'stop' | 'tool_calls' | 'length' = 'stop'): Uint8Array {
    return this.chunk({}, reason);
  }

  /** [DONE] sentinel */
  done(): Uint8Array {
    return this.encoder.encode('data: [DONE]\n\n');
  }

  /** Write an SSE error comment (non-standard but helpful for debugging) */
  errorChunk(_message: string): Uint8Array {
    const payload = {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
    return this.encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }
}
