import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, ToolCall } from '../types';
import { createOpenAIResponse, StreamSession } from '../utils/response-mapper';

export class AnthropicProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const client = new Anthropic({ apiKey });

      const { system, messages } = this.convertMessages(request.messages);

      const tools = request.tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description || '',
        input_schema: tool.function.parameters || {},
      }));

      const params: any = {
        model: this.model,
        messages,
        max_tokens: request.max_tokens || 4096,
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

      if (request.stream) {
        return this.handleStream(client, params);
      }
      return this.handleNonStream(client, params);
    } catch (error) {
      return this.handleError(error, 'AnthropicProvider');
    }
  }

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
              await writer.write(
                session.toolCallArgsChunk(toolCallIndex, event.delta.partial_json)
              );
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

  private convertMessages(messages: OpenAIMessage[]): {
    system?: string;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const convertedMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content || '';
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        const content: any[] = [];

        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }

        if (msg.tool_calls) {
          for (const toolCall of msg.tool_calls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments),
            });
          }
        }

        if (content.length > 0) {
          convertedMessages.push({ role: msg.role, content });
        }
      } else if (msg.role === 'tool') {
        convertedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id!,
              content: msg.content || '',
            },
          ],
        });
      }
    }

    return { system, messages: convertedMessages };
  }
}
