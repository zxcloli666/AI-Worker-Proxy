import { OpenAIChatRequest, ProviderResponse } from '../types';

export interface AIProvider {
  /**
   * Send a chat completion request
   * @param request OpenAI-format request
   * @param apiKey API key to use
   * @returns Provider response with either response object or stream
   */
  chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse>;
}

export abstract class BaseProvider implements AIProvider {
  constructor(
    protected model: string,
    protected baseUrl?: string
  ) {}

  abstract chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse>;

  protected handleError(error: unknown, context: string): ProviderResponse {
    console.error(`[${context}] Error:`, error);

    const e = error as { message?: string; status?: number; statusCode?: number };
    let statusCode = 500;
    const message = e.message || 'Unknown error';

    if (e.status) {
      statusCode = e.status;
    } else if (e.statusCode) {
      statusCode = e.statusCode;
    }

    return {
      success: false,
      error: message,
      statusCode,
    };
  }
}
