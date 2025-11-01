import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage } from '../types';
import { createOpenAIResponse, createStreamChunk } from '../utils/response-mapper';

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

      // Convert OpenAI messages to Cloudflare AI format
      const messages = this.convertMessages(request.messages);

      const params: any = {
        messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stream: request.stream || false,
      };

      if (request.stream) {
        return this.handleStream(params);
      } else {
        return this.handleNonStream(params);
      }
    } catch (error) {
      return this.handleError(error, 'CloudflareAIProvider');
    }
  }

  private async handleNonStream(params: any): Promise<ProviderResponse> {
    const response = await this.aiBinding.run(this.model, params);

    // Cloudflare AI response format
    let content = '';
    if (response.response) {
      content = response.response;
    } else if (typeof response === 'string') {
      content = response;
    }

    const openAIResponse = createOpenAIResponse(content, this.model);

    return {
      success: true,
      response: openAIResponse,
    };
  }

  private async handleStream(params: any): Promise<ProviderResponse> {
    const cfStream = await this.aiBinding.run(this.model, params);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process stream in background
    (async () => {
      try {
        let isFirst = true;

        // Cloudflare AI returns a ReadableStream
        const reader = cfStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Parse the chunk - Cloudflare AI might send different formats
          let text = '';
          if (typeof value === 'string') {
            text = value;
          } else if (value.response) {
            text = value.response;
          } else {
            // Try to decode if it's bytes
            const decoder = new TextDecoder();
            text = decoder.decode(value);
          }

          if (text) {
            const delta = isFirst
              ? { content: text, role: 'assistant' as const }
              : { content: text };

            const chunk = createStreamChunk(delta, this.model);
            await writer.write(encoder.encode(chunk));
            isFirst = false;
          }
        }

        // Send final chunk
        const finishChunk = createStreamChunk({}, this.model, 'stop');
        await writer.write(encoder.encode(finishChunk));
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

  private convertMessages(messages: OpenAIMessage[]): any[] {
    return messages
      .filter((msg) => msg.role !== 'system') // CF AI doesn't support system messages separately
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content || '',
      }));
  }
}
