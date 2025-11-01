import { ProviderConfig, Env, OpenAIChatRequest, ProviderResponse } from './types';
import { createProvider } from './providers';
import { isRetryableError } from './utils/error-handler';

export class TokenManager {
  constructor(
    private config: ProviderConfig,
    private env: Env
  ) {}

  /**
   * Try to execute request with token rotation
   * Will try all tokens in order until one succeeds
   */
  async executeWithRotation(request: OpenAIChatRequest): Promise<ProviderResponse> {
    const provider = createProvider(this.config, this.env);
    const apiKeys = this.getApiKeys();

    if (apiKeys.length === 0) {
      // For providers that don't need API keys (like Cloudflare AI)
      return await provider.chat(request, '');
    }

    let lastError: any = null;

    // Try each API key in order
    for (const apiKey of apiKeys) {
      try {
        console.log(
          `[TokenManager] Trying ${this.config.provider}/${this.config.model} with key ending in ...${apiKey.slice(-4)}`
        );

        const response = await provider.chat(request, apiKey);

        if (response.success) {
          console.log(`[TokenManager] Success with key ending in ...${apiKey.slice(-4)}`);
          return response;
        }

        // If response failed but it's retryable, try next key
        lastError = response.error;
        console.log(
          `[TokenManager] Failed with key ending in ...${apiKey.slice(-4)}: ${response.error}`
        );

        // If it's not a retryable error, don't try other keys for this provider
        if (response.statusCode && !this.isRetryableStatusCode(response.statusCode)) {
          break;
        }
      } catch (error) {
        lastError = error;
        console.error(`[TokenManager] Exception with key ending in ...${apiKey.slice(-4)}:`, error);

        // If it's a retryable error, continue to next key
        if (!isRetryableError(error)) {
          break;
        }
      }
    }

    // All keys failed
    return {
      success: false,
      error: lastError?.message || lastError || 'All API keys failed',
      statusCode: lastError?.statusCode || 500,
    };
  }

  private getApiKeys(): string[] {
    const keys: string[] = [];

    for (const keyName of this.config.apiKeys) {
      const keyValue = this.env[keyName];
      if (keyValue) {
        keys.push(keyValue);
      } else {
        console.warn(`[TokenManager] API key not found in env: ${keyName}`);
      }
    }

    return keys;
  }

  private isRetryableStatusCode(statusCode: number): boolean {
    return statusCode === 429 || statusCode === 503 || statusCode === 502;
  }
}
