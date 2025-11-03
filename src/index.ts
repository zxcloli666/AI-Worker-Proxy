import { Env, OpenAIChatRequest } from './types';
import { Router } from './router';
import { ProxyError, createErrorResponse } from './utils/error-handler';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getCORSHeaders(),
      });
    }

    try {
      // Verify authentication
      if (!verifyAuth(request, env)) {
        throw new ProxyError('Unauthorized', 401, 'invalid_auth');
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Health check endpoint
      if (path === '/health' || path === '/') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'ai-worker-proxy',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...getCORSHeaders(),
            },
          }
        );
      }

      // Only accept POST requests for chat completions
      if (request.method !== 'POST') {
        throw new ProxyError('Method not allowed', 405);
      }

      // Parse request body
      const body = await request.json();
      const chatRequest = body as OpenAIChatRequest;

      // Validate request
      if (!chatRequest.messages || !Array.isArray(chatRequest.messages)) {
        throw new ProxyError('Invalid request: messages array is required', 400);
      }

      if (!chatRequest.model) {
        throw new ProxyError('Invalid request: model is required', 400);
      }

      console.log(`[Worker] Processing request for model: ${chatRequest.model}`);
      console.log(`[Worker] Stream mode: ${chatRequest.stream || false}`);

      // Route request to appropriate providers based on model name
      const router = new Router(env);
      const response = await router.executeWithFallback(chatRequest);

      if (!response.success) {
        throw new ProxyError(response.error || 'All providers failed', response.statusCode || 500);
      }

      // Return streaming response
      if (response.stream) {
        return new Response(response.stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...getCORSHeaders(),
          },
        });
      }

      // Return non-streaming response
      return new Response(JSON.stringify(response.response), {
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(),
        },
      });
    } catch (error) {
      console.error('[Worker] Error:', error);
      const errorResponse = createErrorResponse(error);

      // Add CORS headers to error response
      const headers = new Headers(errorResponse.headers);
      Object.entries(getCORSHeaders()).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(errorResponse.body, {
        status: errorResponse.status,
        headers,
      });
    }
  },
};

function getCORSHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function verifyAuth(request: Request, env: Env): boolean {
  // Skip auth for health check
  const url = new URL(request.url);
  if (url.pathname === '/health' || url.pathname === '/') {
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  return token === env.PROXY_AUTH_TOKEN;
}
