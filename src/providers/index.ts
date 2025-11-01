import { AIProvider } from './base';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { OpenAIProvider } from './openai';
import { CloudflareAIProvider } from './cloudflare-ai';
import { ProviderConfig, Env } from '../types';

export function createProvider(config: ProviderConfig, env: Env): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.model);

    case 'google':
      return new GoogleProvider(config.model);

    case 'openai':
      return new OpenAIProvider(config.model);

    case 'openai-compatible':
      if (!config.baseUrl) {
        throw new Error('baseUrl is required for openai-compatible provider');
      }
      return new OpenAIProvider(config.model, config.baseUrl);

    case 'cloudflare-ai':
      if (!env.AI) {
        throw new Error('Cloudflare AI binding not found. Make sure AI binding is configured in wrangler.toml');
      }
      return new CloudflareAIProvider(config.model, env.AI);

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export { AIProvider };
