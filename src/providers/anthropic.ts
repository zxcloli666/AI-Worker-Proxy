import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base';
import { AnthropicRequest } from '../anthropic-types';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, ToolCall } from '../types';
import { createOpenAIResponse, StreamSession } from '../utils/response-mapper';

export class AnthropicProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const clientOpts: Record<string, unknown> = { apiKey };
      if (this.baseUrl) {
        clientOpts.baseURL = this.baseUrl;
      }
      const client = new Anthropic(clientOpts);

      const { system, messages } = this.convertMessages(request.messages);

      const tools = request.tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description || '',
        input_schema: tool.function.parameters || {},
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        model: this.model,
        messages,
        max_tokens: request.max_tokens ?? 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        stream: request.stream || false,
      };

      if (system) {
        params.system = system;
      }

      if (tools && tools.length > 0) {
        params.tools = tools;
      }

      // Map OpenAI stop to Anthropic stop_sequences
      if (request.stop) {
        params.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];
      }

      // Map OpenAI tool_choice to Anthropic tool_choice
      if (request.tool_choice) {
        if (request.tool_choice === 'none') {
          params.tool_choice = { type: 'none' };
        } else if (request.tool_choice === 'auto') {
          params.tool_choice = { type: 'auto' };
        } else if (
          typeof request.tool_choice === 'object' &&
          request.tool_choice.type === 'function'
        ) {
          params.tool_choice = {
            type: 'tool',
            name: request.tool_choice.function.name,
          };
        }
      }

      if (request.stream) {
        return this.handleStream(client, params);
      }
      return this.handleNonStream(client, params);
    } catch (error) {
      return this.handleError(error, 'AnthropicProvider');
    }
  }

  /**
   * Anthropic-native chat — bypasses OpenAI format conversion.
   * Accepts AnthropicRequest directly and returns Anthropic-native response.
   */
  async nativeChat(request: AnthropicRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const clientOpts: Record<string, unknown> = { apiKey };
      if (this.baseUrl) {
        clientOpts.baseURL = this.baseUrl;
      }
      const client = new Anthropic(clientOpts);

      const params: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens ?? 4096,
        stream: request.stream || false,
      };

      if (request.system) params.system = request.system;
      if (request.temperature !== undefined) params.temperature = request.temperature;
      if (request.top_p !== undefined) params.top_p = request.top_p;
      if (request.top_k !== undefined) params.top_k = request.top_k;
      if (request.stop_sequences) params.stop_sequences = request.stop_sequences;
      if (request.metadata) params.metadata = request.metadata;

      // Pass tools directly (they're already in Anthropic format)
      if (request.tools && request.tools.length > 0) {
        params.tools = request.tools;
      }

      if (request.tool_choice) {
        params.tool_choice = request.tool_choice;
      }

      if (request.stream) {
        return this.handleNativeStream(client, params);
      }
      return this.handleNativeNonStream(client, params);
    } catch (error) {
      return this.handleError(error, 'AnthropicProvider.nativeChat');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleNonStream(client: Anthropic, params: any): Promise<ProviderResponse> {
    const response = await client.messages.create(params);

    let content = '';
    let toolCalls: ToolCall[] | undefined;

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        if (!toolCalls) toolCalls = [];
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    const finishReason = response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop';

    return {
      success: true,
      response: createOpenAIResponse(content, this.model, finishReason, toolCalls),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleStream(client: Anthropic, params: any): Promise<ProviderResponse> {
    const stream = await client.messages.stream(params);
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const session = new StreamSession(this.model);

    (async () => {
      try {
        // Send initial role chunk per OpenAI spec
        await writer.write(session.roleChunk());

        // Track tool calls by index for proper incremental streaming
        let toolCallIndex = -1;
        let hasToolCalls = false;

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolCallIndex++;
              hasToolCalls = true;
              // Send tool call start with id, name, empty args
              await writer.write(
                session.toolCallStartChunk(
                  toolCallIndex,
                  event.content_block.id,
                  event.content_block.name
                )
              );
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              await writer.write(session.textChunk(event.delta.text));
            } else if (event.delta.type === 'input_json_delta') {
              // Stream arguments incrementally
              if (toolCallIndex >= 0) {
                await writer.write(
                  session.toolCallArgsChunk(toolCallIndex, event.delta.partial_json)
                );
              }
            }
          } else if (event.type === 'message_stop') {
            const reason = hasToolCalls ? 'tool_calls' : 'stop';
            await writer.write(session.finishChunk(reason));
            await writer.write(session.done());
          }
        }
      } catch (error) {
        console.error('[AnthropicProvider] Stream error:', error);
        try {
          await writer.write(session.finishChunk('stop'));
          await writer.write(session.done());
        } catch {
          // Writer may already be closed
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // Already closed
        }
      }
    })();

    return { success: true, stream: readable };
  }

  /**
   * Native non-stream: forward Anthropic SDK Message directly as rawResponse.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleNativeNonStream(client: Anthropic, params: any): Promise<ProviderResponse> {
    const response = await client.messages.create(params);
    return {
      success: true,
      rawResponse: response,
    };
  }

  /**
   * Native stream: re-serialize Anthropic SDK StreamEvents as SSE and forward.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleNativeStream(client: Anthropic, params: any): Promise<ProviderResponse> {
    const stream = await client.messages.stream(params);
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        for await (const event of stream) {
          const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          await writer.write(encoder.encode(line));
        }
      } catch (error) {
        console.error('[AnthropicProvider] Native stream error:', error);
        try {
          const errorEvent = { type: 'message_stop' };
          await writer.write(encoder.encode(`event: message_stop\ndata: ${JSON.stringify(errorEvent)}\n\n`));
        } catch {
          // Writer may already be closed
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // Already closed
        }
      }
    })();

    return { success: true, stream: readable };
  }

  private convertMessages(messages: OpenAIMessage[]): {
    system?: string;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const convertedMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system =
          typeof msg.content === 'string'
            ? msg.content
            : msg.content
              ? msg.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ')
              : '';
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content: any[] = [];

        if (msg.content) {
          if (typeof msg.content === 'string') {
            content.push({ type: 'text', text: msg.content });
          } else {
            for (const part of msg.content) {
              if (part.type === 'text') {
                content.push({ type: 'text', text: part.text });
              } else if (part.type === 'image_url') {
                // Parse data URI to extract mime type and base64 data
                const dataUri = part.image_url.url;
                const commaIdx = dataUri.indexOf(',');
                if (commaIdx !== -1) {
                  const header = dataUri.slice(0, commaIdx);
                  const base64Data = dataUri.slice(commaIdx + 1);
                  const mimeMatch = header.match(/^data:([^;]+)/);
                  const mediaType = mimeMatch ? mimeMatch[1] : 'image/png';
                  content.push({
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: base64Data },
                  });
                }
              }
            }
          }
        }

        if (msg.tool_calls) {
          for (const toolCall of msg.tool_calls) {
            let parsedInput: unknown;
            try {
              parsedInput = JSON.parse(toolCall.function.arguments);
            } catch (e) {
              // Fall back to empty object if arguments are not valid JSON
              parsedInput = {};
            }
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: parsedInput,
            });
          }
        }

        if (content.length > 0) {
          convertedMessages.push({ role: msg.role, content });
        }
      } else if (msg.role === 'tool') {
        const toolContent =
          typeof msg.content === 'string'
            ? msg.content || ''
            : msg.content
              ? msg.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ')
              : '';
        convertedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id!,
              content: toolContent,
            },
          ],
        });
      }
    }

    return { system, messages: convertedMessages };
  }
}
