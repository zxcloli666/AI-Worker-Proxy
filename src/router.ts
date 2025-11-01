import { RouteConfig, ProviderConfig, Env, OpenAIChatRequest, ProviderResponse } from './types';
import { TokenManager } from './token-manager';
import { ProxyError } from './utils/error-handler';

export class Router {
  private routes: RouteConfig;

  constructor(private env: Env) {
    this.routes = this.parseRoutesConfig();
  }

  /**
   * Get provider configurations for a given model name
   */
  getProvidersForModel(model: string): ProviderConfig[] {
    // Check exact match first
    if (this.routes[model]) {
      return this.routes[model];
    }

    // Default fallback - use first available route or throw error
    const defaultRoute = Object.values(this.routes)[0];
    if (defaultRoute) {
      console.log(`[Router] No configuration found for model "${model}", using default route`);
      return defaultRoute;
    }

    throw new ProxyError(`No providers configured for model: ${model}`, 404);
  }

  /**
   * Execute request with provider fallback
   * Will try providers in order until one succeeds
   */
  async executeWithFallback(request: OpenAIChatRequest): Promise<ProviderResponse> {
    const model = request.model;
    if (!model) {
      throw new ProxyError('Model name is required', 400);
    }

    const providers = this.getProvidersForModel(model);

    console.log(`[Router] Model "${model}" has ${providers.length} provider(s) configured`);

    let lastError: any = null;

    // Try each provider in order
    for (let i = 0; i < providers.length; i++) {
      const config = providers[i];
      console.log(
        `[Router] Trying provider ${i + 1}/${providers.length}: ${config.provider}/${config.model}`
      );

      try {
        const manager = new TokenManager(config, this.env);
        const response = await manager.executeWithRotation(request);

        if (response.success) {
          console.log(`[Router] Success with provider: ${config.provider}/${config.model}`);
          return response;
        }

        lastError = response.error;
        console.log(
          `[Router] Provider ${config.provider}/${config.model} failed: ${response.error}`
        );
      } catch (error) {
        lastError = error;
        console.error(`[Router] Provider ${config.provider}/${config.model} exception:`, error);
      }
    }

    // All providers failed
    return {
      success: false,
      error: `All providers failed. Last error: ${lastError?.message || lastError || 'Unknown error'}`,
      statusCode: 500,
    };
  }

  private parseRoutesConfig(): RouteConfig {
    try {
      const configStr = this.env.ROUTES_CONFIG;
      if (!configStr) {
        throw new Error('ROUTES_CONFIG not found in environment');
      }

      const config = JSON.parse(configStr);
      console.log('[Router] Loaded routes:', Object.keys(config));
      return config;
    } catch (error) {
      console.error('[Router] Failed to parse ROUTES_CONFIG:', error);
      throw new ProxyError('Invalid ROUTES_CONFIG', 500);
    }
  }
}
