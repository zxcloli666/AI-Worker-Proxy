import { RouteConfig, ProviderConfig, Env, OpenAIChatRequest, ProviderResponse } from './types';
import { TokenManager } from './token-manager';
import { ProxyError } from './utils/error-handler';

export class Router {
  private routes: RouteConfig;

  constructor(private env: Env) {
    this.routes = this.parseRoutesConfig();
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): Array<{
    id: string;
    object: string;
    owned_by: string;
    permission: string[];
  }> {
    const models = Object.keys(this.routes);
    return models.map((model) => ({
      id: model,
      object: 'model',
      owned_by: 'ai-worker-proxy',
      permission: [],
    }));
  }

  /**
   * Get provider configurations for a given model name
   */
  getProvidersForModel(model: string): ProviderConfig[] {
    // Check exact match first
    if (this.routes[model]) {
      const providers = this.routes[model];
      if (!Array.isArray(providers) || providers.length === 0) {
        throw new ProxyError(`No providers configured for model: ${model}`, 404);
      }
      return providers;
    }

    throw new ProxyError(`No providers configured for model: ${model}`, 404);
  }

  /**
   * Execute request with provider fallback
   * Will try providers in order until one succeeds.
   *
   * @param preferredType - If set, reorder providers so that matching type(s) come first.
   *                        For example, 'openai' moves openai/openai-compatible to the front.
   */
  async executeWithFallback(
    request: OpenAIChatRequest,
    preferredType?: 'openai' | 'anthropic',
    overrideProviders?: ProviderConfig[]
  ): Promise<ProviderResponse> {
    const model = request.model;
    if (!model) {
      throw new ProxyError('Model name is required', 400);
    }

    // Use override providers if provided, otherwise look up from config
    const providers = overrideProviders ?? this.getProvidersForModel(model);

    // Reorder: preferred type first, rest after
    const orderedProviders = preferredType
      ? this.sortByPreferredType(providers, preferredType)
      : providers;

    console.log(`[Router] Model "${model}" has ${providers.length} provider(s) configured`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastError: any = null;

    // Try each provider in order
    for (let i = 0; i < orderedProviders.length; i++) {
      const config = orderedProviders[i];
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

  /**
   * Sort providers so that entries matching the preferred type come first.
   * E.g. preferredType='openai' puts openai and openai-compatible before all others.
   * The relative order within each group is preserved from the original array.
   */
  private sortByPreferredType(
    providers: ProviderConfig[],
    preferredType: 'openai' | 'anthropic'
  ): ProviderConfig[] {
    const preferred = providers.filter(
      (p) => p.provider === preferredType || p.provider === `${preferredType}-compatible`
    );
    const rest = providers.filter(
      (p) => p.provider !== preferredType && p.provider !== `${preferredType}-compatible`
    );
    return [...preferred, ...rest];
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
