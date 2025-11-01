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

  protected handleError(error: any, context: string): ProviderResponse {
    console.error(`[${context}] Error:`, error);

    let statusCode = 500;
    let message = error?.message || 'Unknown error';

    if (error?.status) {
      statusCode = error.status;
    } else if (error?.statusCode) {
      statusCode = error.statusCode;
    }

    return {
      success: false,
      error: message,
      statusCode,
    };
  }
}
