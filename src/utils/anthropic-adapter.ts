import { AnthropicRequest, AnthropicResponse, AnthropicContentBlock } from '../anthropic-types';
import { OpenAIChatRequest, OpenAIChatResponse, OpenAIMessage, ContentPart } from '../types';

/**
 * Convert an Anthropic-format request to OpenAI-format request.
 * Used when the target provider is NOT anthropic-compatible.
 */
export function convertAnthropicRequestToOpenAI(anthropicReq: AnthropicRequest): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];

  // Extract system message
  if (anthropicReq.system) {
    messages.push({ role: 'system', content: anthropicReq.system });
  }

  // Convert messages
  for (const msg of anthropicReq.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content });
    } else {
      // Content is an array of blocks
      const contentParts: ContentPart[] = [];
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          contentParts.push({ type: 'text', text: block.text });
        } else if (block.type === 'image' && block.source) {
          // Convert Anthropic image block to OpenAI image_url format
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
            },
          });
        } else if (block.type === 'tool_result') {
          // Tool results in Anthropic are content blocks in user messages;
          // in OpenAI they are separate messages with role 'tool'
          const toolContent =
            typeof block.content === 'string'
              ? block.content
              : block.content
                ? block.content
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text)
                    .join(' ')
                : '';
          messages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id || '',
            content: toolContent,
          });
          continue; // Already pushed, skip the main push below
        } else if (block.type === 'tool_use' && block.name) {
          // Tool use from assistant messages
          messages.push({
            role: msg.role,
            content: null,
            tool_calls: [
              {
                id: block.id || '',
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              },
            ],
          });
          continue; // Already pushed
        }
      }
      if (contentParts.length > 0) {
        // Pure single text part — keep as string for backward compatibility
        if (contentParts.length === 1 && contentParts[0].type === 'text') {
          messages.push({ role: msg.role, content: contentParts[0].text });
        } else {
          // Has images or mixed content — use structured array format
          messages.push({ role: msg.role, content: contentParts });
        }
      }
    }
  }

  const openAIReq: OpenAIChatRequest = {
    model: anthropicReq.model,
    messages,
    max_tokens: anthropicReq.max_tokens || 4096,
    stream: anthropicReq.stream || false,
  };

  if (anthropicReq.temperature !== undefined) openAIReq.temperature = anthropicReq.temperature;
  if (anthropicReq.top_p !== undefined) openAIReq.top_p = anthropicReq.top_p;
  if (anthropicReq.stop_sequences) openAIReq.stop = anthropicReq.stop_sequences;

  // Convert Anthropic tools to OpenAI tools
  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    openAIReq.tools = anthropicReq.tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.input_schema || {},
      },
    }));
  }

  return openAIReq;
}

/**
 * Map OpenAI finish_reason to Anthropic stop_reason.
 */
function mapFinishReason(
  reason: string | null | undefined
): 'end_turn' | 'max_tokens' | 'tool_use' | null {
  switch (reason) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
      return 'tool_use';
    default:
      return null;
  }
}

/**
 * Convert an OpenAI-format chat response to Anthropic-format response.
 */
export function convertOpenAIResponseToAnthropic(
  openaiResp: OpenAIChatResponse,
  model: string
): AnthropicResponse {
  const choice = openaiResp.choices[0];
  const message = choice.message;
  const content: AnthropicContentBlock[] = [];

  // Add text content
  if (message.content) {
    const textContent =
      typeof message.content === 'string'
        ? message.content
        : message.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ');
    content.push({ type: 'text', text: textContent });
  }

  // Add tool calls
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      let parsedInput: unknown;
      try {
        parsedInput = JSON.parse(tc.function.arguments);
      } catch {
        parsedInput = {};
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: parsedInput,
      });
    }
  }

  return {
    id: openaiResp.id,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: mapFinishReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: openaiResp.usage?.prompt_tokens || 0,
      output_tokens: openaiResp.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Adapter that converts OpenAI SSE stream chunks to Anthropic SSE events.
 * Used when the target provider is NOT anthropic-compatible.
 */
export class AnthropicStreamAdapter {
  private encoder = new TextEncoder();
  private blockIndex = 0;
  private started = false;
  private textBlockActive = false;
  private toolBlockActive = false;

  constructor(
    private model: string,
    private messageId: string
  ) {}

  private encodeSSE(event: string, data: unknown): Uint8Array {
    return this.encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private startMessage(controller: TransformStreamDefaultController): void {
    controller.enqueue(
      this.encodeSSE('message_start', {
        type: 'message_start',
        message: {
          id: this.messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: this.model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      })
    );
  }

  private startTextBlock(controller: TransformStreamDefaultController): void {
    this.textBlockActive = true;
    controller.enqueue(
      this.encodeSSE('content_block_start', {
        type: 'content_block_start',
        index: this.blockIndex,
        content_block: { type: 'text', text: '' },
      })
    );
  }

  private stopBlock(controller: TransformStreamDefaultController): void {
    controller.enqueue(
      this.encodeSSE('content_block_stop', {
        type: 'content_block_stop',
        index: this.blockIndex,
      })
    );
    this.textBlockActive = false;
    this.toolBlockActive = false;
  }

  createTransformStream(): TransformStream<Uint8Array, Uint8Array> {
    let currentToolIndex = -1;
    let lineBuffer = '';

    return new TransformStream({
      transform: (chunk, controller) => {
        // Use { stream: true } for proper multi-byte UTF-8 handling across chunks
        const text = lineBuffer + new TextDecoder().decode(chunk, { stream: true });
        const lines = text.split('\n');

        // Last element may be a partial line — keep it in the buffer for the next chunk
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          currentToolIndex = this.processSSELine(line, controller, currentToolIndex);
        }
      },
      flush: (controller) => {
        // Process any remaining buffered data
        if (lineBuffer) {
          this.processSSELine(lineBuffer, controller, currentToolIndex);
        }
        lineBuffer = '';
      },
    });
  }

  /**
   * Process a single SSE line and return the updated tool call index.
   */
  private processSSELine(
    line: string,
    controller: TransformStreamDefaultController,
    toolIndex: number
  ): number {
    if (!line.startsWith('data: ')) return toolIndex;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') return toolIndex;

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      // Invalid JSON in SSE — skip this line
      return toolIndex;
    }

    const choice = parsed.choices?.[0];
    if (!choice) return toolIndex;

    const { delta, finish_reason } = choice;
    let currentToolIndex = toolIndex;

    // Start message on first chunk
    if (!this.started) {
      this.started = true;
      this.startMessage(controller);
    }

    // Text content delta
    if (delta.content !== undefined && delta.content !== null) {
      if (!this.textBlockActive && !this.toolBlockActive) {
        this.startTextBlock(controller);
      }
      controller.enqueue(
        this.encodeSSE('content_block_delta', {
          type: 'content_block_delta',
          index: this.blockIndex,
          delta: { type: 'text_delta', text: delta.content },
        })
      );
    }

    // Tool call delta
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.id) {
          // Close current text block
          if (this.textBlockActive) {
            this.stopBlock(controller);
          }

          currentToolIndex++;
          this.blockIndex = currentToolIndex;
          this.toolBlockActive = true;

          controller.enqueue(
            this.encodeSSE('content_block_start', {
              type: 'content_block_start',
              index: this.blockIndex,
              content_block: {
                type: 'tool_use',
                id: tc.id,
                name: tc.function?.name || '',
                input: {},
              },
            })
          );
        }

        if (tc.function?.arguments !== undefined) {
          controller.enqueue(
            this.encodeSSE('content_block_delta', {
              type: 'content_block_delta',
              index: this.blockIndex,
              delta: {
                type: 'input_json_delta',
                partial_json: tc.function.arguments,
              },
            })
          );
        }
      }
    }

    // Finish reason
    if (finish_reason) {
      if (this.textBlockActive || this.toolBlockActive) {
        this.stopBlock(controller);
      }

      controller.enqueue(
        this.encodeSSE('message_delta', {
          type: 'message_delta',
          delta: {
            stop_reason: mapFinishReason(finish_reason),
            stop_sequence: null,
          },
          usage: { output_tokens: 0 },
        })
      );

      controller.enqueue(this.encodeSSE('message_stop', { type: 'message_stop' }));
    }

    return currentToolIndex;
  }
}
