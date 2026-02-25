import OpenAI from 'openai';
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse } from '../types';

export class OpenAIProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: this.baseUrl,
      });

      const params:
        | OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
        | OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
        model: this.model,
        messages: request.messages as any,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop,
        stream: request.stream || false,
        tools: request.tools as any,
        tool_choice: request.tool_choice as any,
      };

      if (request.stream) {
        return this.handleStream(client, params as OpenAI.Chat.ChatCompletionCreateParamsStreaming);
      }
      return this.handleNonStream(
        client,
        params as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );
    } catch (error) {
      return this.handleError(error, 'OpenAIProvider');
    }
  }

  private async handleNonStream(
    client: OpenAI,
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  ): Promise<ProviderResponse> {
    const response = await client.chat.completions.create(params);
    return { success: true, response: response as any };
  }

  private async handleStream(
    client: OpenAI,
    params: OpenAI.Chat.ChatCompletionCreateParamsStreaming
  ): Promise<ProviderResponse> {
    const stream = await client.chat.completions.create(params);
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        for await (const chunk of stream) {
          // OpenAI SDK already returns properly formatted chunks with `index` on tool_calls.
          // Pass through as-is for maximum compatibility.
          await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        console.error('[OpenAIProvider] Stream error:', error);
        try {
          // Send a clean finish so the client doesn't hang
          const errorFinish = {
            id: 'chatcmpl-error',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: params.model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(errorFinish)}\n\n`));
          await writer.write(encoder.encode('data: [DONE]\n\n'));
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
}
