export class ProxyError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

export function createErrorResponse(error: unknown): Response {
  if (error instanceof ProxyError) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          type: 'proxy_error',
          code: error.code,
        },
      }),
      {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Generic error
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: 'internal_error',
      },
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export function isRateLimitError(error: any): boolean {
  return (
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.message?.toLowerCase().includes('rate limit') ||
    error?.code === 'rate_limit_exceeded'
  );
}

export function isRetryableError(error: any): boolean {
  return (
    isRateLimitError(error) ||
    error?.status === 503 ||
    error?.statusCode === 503 ||
    error?.status === 502 ||
    error?.statusCode === 502 ||
    error?.message?.toLowerCase().includes('timeout') ||
    error?.message?.toLowerCase().includes('overloaded')
  );
}
