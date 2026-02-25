import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, Tool, ToolCall } from '../types';
import { createOpenAIResponse, StreamSession, generateId } from '../utils/response-mapper';

export class CloudflareAIProvider extends BaseProvider {
  constructor(
    model: string,
    private aiBinding: any
  ) {
    super(model);
  }

  async chat(request: OpenAIChatRequest, _apiKey: string): Promise<ProviderResponse> {
    try {
      if (!this.aiBinding) {
        throw new Error('Cloudflare AI binding not available');
      }

      const messages = this.convertMessages(request.messages);

      const params: any = {
        messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stream: request.stream || false,
      };

      if (request.tools && request.tools.length > 0) {
        params.tools = this.convertTools(request.tools);
      }

      if (request.stream) {
        return this.handleStream(params);
      }
      return this.handleNonStream(params);
    } catch (error) {
      return this.handleError(error, 'CloudflareAIProvider');
    }
  }

  private async handleNonStream(params: any): Promise<ProviderResponse> {
    const response = await this.aiBinding.run(this.model, params);

    let content = '';
    if (response.response) {
      content = response.response;
    } else if (typeof response === 'string') {
      content = response;
    }

    const openAIResponse = createOpenAIResponse(content, this.model);

    if (response.tool_calls && response.tool_calls.length > 0) {
      openAIResponse.choices[0].message.tool_calls = this.convertToolCalls(response.tool_calls);
      openAIResponse.choices[0].message.content = null;
      openAIResponse.choices[0].finish_reason = 'tool_calls';
    }

    return { success: true, response: openAIResponse };
  }

  private async handleStream(params: any): Promise<ProviderResponse> {
    const cfStream = await this.aiBinding.run(this.model, params);
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const session = new StreamSession(this.model);

    (async () => {
      try {
        await writer.write(session.roleChunk());

        const reader = cfStream.getReader();
        let hasToolCalls = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          let text = '';
          let toolCalls: any[] | undefined;

          if (typeof value === 'string') {
            text = value;
          } else if (value.response) {
            text = value.response;
            if (value.tool_calls) {
              toolCalls = value.tool_calls;
            }
          } else {
            const decoder = new TextDecoder();
            text = decoder.decode(value);
          }

          if (toolCalls && toolCalls.length > 0) {
            hasToolCalls = true;
            for (let i = 0; i < toolCalls.length; i++) {
              const tc = toolCalls[i];
              const callId = `call_${generateId(24)}`;
              await writer.write(session.toolCallStartChunk(i, callId, tc.name));
              await writer.write(
                session.toolCallArgsChunk(i, JSON.stringify(tc.arguments))
              );
            }
          } else if (text) {
            await writer.write(session.textChunk(text));
          }
        }

        await writer.write(session.finishChunk(hasToolCalls ? 'tool_calls' : 'stop'));
        await writer.write(session.done());
      } catch (error) {
        console.error('[CloudflareAIProvider] Stream error:', error);
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

  private convertMessages(messages: OpenAIMessage[]): any[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return { role: 'user', content: msg.content || '' };
      }
      if (msg.role === 'assistant' && msg.tool_calls) {
        return { role: 'assistant', content: msg.content || '' };
      }
      return {
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content || '',
      };
    });
  }

  private convertTools(tools: Tool[]): any[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description || '',
        parameters: tool.function.parameters || { type: 'object', properties: {} },
      },
    }));
  }

  private convertToolCalls(cfToolCalls: any[]): ToolCall[] {
    return cfToolCalls.map((call) => ({
      id: `call_${generateId(24)}`,
      type: 'function' as const,
      function: {
        name: call.name,
        arguments: JSON.stringify(call.arguments),
      },
    }));
  }
}
