import { Env, OpenAIChatRequest, ProviderConfig } from './types';
import { AnthropicRequest } from './anthropic-types';
import { Router } from './router';
import {
  ProxyError,
  createErrorResponse,
  withTimeout,
  isRetryableError,
} from './utils/error-handler';
import { createProvider } from './providers';
import { AnthropicProvider } from './providers/anthropic';
import {
  convertAnthropicRequestToOpenAI,
  convertOpenAIResponseToAnthropic,
  AnthropicStreamAdapter,
} from './utils/anthropic-adapter';
import { generateId } from './utils/response-mapper';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Health check — no auth required
      if ((path === '/health' || path === '/') && request.method === 'GET') {
        return json({
          status: 'ok',
          service: 'ai-worker-proxy',
          timestamp: new Date().toISOString(),
        });
      }

      // Models list — no auth required (matches OpenAI behavior)
      if ((path === '/models' || path === '/v1/models') && request.method === 'GET') {
        const router = new Router(env);
        return json({
          object: 'list',
          data: router.getAvailableModels(),
        });
      }

      // Everything below requires auth
      if (!verifyAuth(request, env)) {
        throw new ProxyError('Unauthorized', 401, 'invalid_auth');
      }

      // Anthropic-format chat completions — POST only
      if (
        request.method === 'POST' &&
        (path === '/anthropic/v1/messages' || path === '/anthropic/messages')
      ) {
        return handleAnthropicChat(request, env);
      }

      // OpenAI-format chat completions — POST only
      if (
        request.method === 'POST' &&
        (path === '/' || path === '/v1/chat/completions' || path === '/chat/completions')
      ) {
        return handleChatCompletion(request, env);
      }

      throw new ProxyError('Not found', 404);
    } catch (error) {
      console.error('[Worker] Error:', error);
      const errorResponse = createErrorResponse(error);
      const headers = new Headers(errorResponse.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        headers.set(key, value);
      }
      return new Response(errorResponse.body, { status: errorResponse.status, headers });
    }
  },
};

// =============================================================================
// OpenAI-format handler (existing)
// =============================================================================

async function handleChatCompletion(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const chatRequest = body as OpenAIChatRequest;

  if (!chatRequest.messages || !Array.isArray(chatRequest.messages)) {
    throw new ProxyError('Invalid request: messages array is required', 400);
  }
  if (!chatRequest.model) {
    throw new ProxyError('Invalid request: model is required', 400);
  }

  console.log(`[Worker] model=${chatRequest.model} stream=${chatRequest.stream || false}`);

  const router = new Router(env);
  const response = await router.executeWithFallback(chatRequest, 'openai');

  if (!response.success) {
    throw new ProxyError(response.error || 'All providers failed', response.statusCode || 500);
  }

  if (response.stream) {
    return new Response(response.stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
    });
  }

  return json(response.response);
}

// =============================================================================
// Anthropic-format handler (dual-path)
// =============================================================================

async function handleAnthropicChat(request: Request, env: Env): Promise<Response> {
  const body: AnthropicRequest = await request.json();

  if (!body.messages || !Array.isArray(body.messages)) {
    throw new ProxyError('Invalid request: messages array is required', 400);
  }
  if (!body.model) {
    throw new ProxyError('Invalid request: model is required', 400);
  }

  console.log(`[AnthropicHandler] model=${body.model} stream=${body.stream || false}`);

  const router = new Router(env);
  const providers = router.getProvidersForModel(body.model);

  // Check if any provider supports Anthropic natively
  const hasAnthropicNative = providers.some(
    (p) => p.provider === 'anthropic' || p.provider === 'anthropic-compatible'
  );

  if (hasAnthropicNative) {
    return handleAnthropicNativePath(body, providers, env);
  }

  return handleAnthropicConversionPath(body, router);
}

/**
 * Anthropic-native path: call AnthropicProvider.nativeChat() directly.
 * No format conversion — preserves Anthropic request/response format end-to-end.
 */
async function handleAnthropicNativePath(
  body: AnthropicRequest,
  providers: ProviderConfig[],
  env: Env
): Promise<Response> {
  let lastError: any = null;

  // First try all anthropic-compatible providers natively
  for (const config of providers) {
    if (config.provider !== 'anthropic' && config.provider !== 'anthropic-compatible') {
      continue;
    }

    const provider = createProvider(config, env) as AnthropicProvider;
    const apiKeys = resolveApiKeys(config, env);

    for (const apiKey of apiKeys) {
      try {
        const result = await withTimeout(provider.nativeChat(body, apiKey));
        if (!result.success) {
          lastError = result.error;
          if (result.statusCode && ![429, 502, 503].includes(result.statusCode)) {
            break;
          }
          continue;
        }

        if (result.stream) {
          return new Response(result.stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              ...CORS_HEADERS,
            },
          });
        }

        return json(result.rawResponse);
      } catch (error: any) {
        lastError = error;
        if (!isRetryableError(error)) {
          break;
        }
      }
    }
  }

  // Fall back to conversion path for any non-Anthropic providers
  const otherProviders = providers.filter(
    (p) => p.provider !== 'anthropic' && p.provider !== 'anthropic-compatible'
  );
  if (otherProviders.length > 0) {
    const router = new Router(env);
    return handleAnthropicConversionPath(body, router, otherProviders);
  }

  throw new ProxyError(
    `All providers failed: ${lastError?.message || lastError}`,
    lastError?.statusCode || 500
  );
}

/**
 * Conversion path: convert Anthropic request → OpenAI → route → convert response back.
 * Used when the target provider does not support Anthropic natively.
 */
async function handleAnthropicConversionPath(
  body: AnthropicRequest,
  router: Router,
  overrideProviders?: ProviderConfig[]
): Promise<Response> {
  const openaiRequest = convertAnthropicRequestToOpenAI(body);

  const response = await router.executeWithFallback(openaiRequest, 'anthropic', overrideProviders);

  if (!response.success) {
    throw new ProxyError(response.error || 'All providers failed', response.statusCode || 500);
  }

  if (response.stream) {
    const adapter = new AnthropicStreamAdapter(body.model, `msg_${generateId()}`);
    const anthropicStream = response.stream.pipeThrough(adapter.createTransformStream());
    return new Response(anthropicStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
    });
  }

  return json(convertOpenAIResponseToAnthropic(response.response!, body.model));
}

// =============================================================================
// Helpers
// =============================================================================

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function verifyAuth(request: Request, env: Env): boolean {
  // OpenAI-style: Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (token === env.PROXY_AUTH_TOKEN) return true;
  }

  // Anthropic-style: x-api-key: <token>
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && apiKey === env.PROXY_AUTH_TOKEN) return true;

  return false;
}

function resolveApiKeys(config: ProviderConfig, env: Env): string[] {
  const keys: string[] = [];
  for (const keyName of config.apiKeys) {
    const value = env[keyName];
    if (value) {
      keys.push(value);
    } else {
      console.warn(`[resolveApiKeys] API key not found in env: ${keyName}`);
    }
  }
  return keys;
}
