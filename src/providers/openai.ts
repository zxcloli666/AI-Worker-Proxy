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

      const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming | OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
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
      } else {
        return this.handleNonStream(client, params as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
      }
    } catch (error) {
      return this.handleError(error, 'OpenAIProvider');
    }
  }

  private async handleNonStream(
    client: OpenAI,
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  ): Promise<ProviderResponse> {
    const response = await client.chat.completions.create(params);

    return {
      success: true,
      response: response as any,
    };
  }

  private async handleStream(
    client: OpenAI,
    params: OpenAI.Chat.ChatCompletionCreateParamsStreaming
  ): Promise<ProviderResponse> {
    const stream = await client.chat.completions.create(params);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process stream in background
    (async () => {
      try {
        for await (const chunk of stream) {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          await writer.write(encoder.encode(data));
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'));
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
}
