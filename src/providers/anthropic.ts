import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, ToolCall } from '../types';
import { createOpenAIResponse, createStreamChunk } from '../utils/response-mapper';

export class AnthropicProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const client = new Anthropic({ apiKey });

      // Convert OpenAI messages to Anthropic format
      const { system, messages } = this.convertMessages(request.messages);

      // Convert tools if present
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
      } else {
        return this.handleNonStream(client, params);
      }
    } catch (error) {
      return this.handleError(error, 'AnthropicProvider');
    }
  }

  private async handleNonStream(
    client: Anthropic,
    params: any
  ): Promise<ProviderResponse> {
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
    const openAIResponse = createOpenAIResponse(content, this.model, finishReason, toolCalls);

    return {
      success: true,
      response: openAIResponse,
    };
  }

  private async handleStream(
    client: Anthropic,
    params: any
  ): Promise<ProviderResponse> {
    const stream = await client.messages.stream(params);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process stream in background
    (async () => {
      try {
        let contentBuffer = '';
        let toolCallBuffer: any = null;

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolCallBuffer = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: '',
              };
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              const text = event.delta.text;
              contentBuffer += text;
              const chunk = createStreamChunk({ content: text, role: 'assistant' }, this.model);
              await writer.write(encoder.encode(chunk));
            } else if (event.delta.type === 'input_json_delta' && toolCallBuffer) {
              toolCallBuffer.input += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (toolCallBuffer) {
              // Send tool call
              const toolCall: ToolCall = {
                id: toolCallBuffer.id,
                type: 'function',
                function: {
                  name: toolCallBuffer.name,
                  arguments: toolCallBuffer.input,
                },
              };
              const chunk = createStreamChunk(
                { tool_calls: [toolCall], role: 'assistant' },
                this.model
              );
              await writer.write(encoder.encode(chunk));
              toolCallBuffer = null;
            }
          } else if (event.type === 'message_stop') {
            const finishReason = toolCallBuffer ? 'tool_calls' : 'stop';
            const chunk = createStreamChunk({}, this.model, finishReason);
            await writer.write(encoder.encode(chunk));
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        await writer.close();
      }
    })();

    return {
      success: true,
      stream: readable,
    };
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

        convertedMessages.push({
          role: msg.role,
          content,
        });
      } else if (msg.role === 'tool') {
        // Tool result
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
