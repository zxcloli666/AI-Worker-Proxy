// OpenAI API types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  n?: number;
}

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<OpenAIMessage>;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
}

// Provider configuration
export interface ProviderConfig {
  provider: 'anthropic' | 'google' | 'openai' | 'openai-compatible' | 'cloudflare-ai';
  model: string;
  apiKeys: string[]; // Array of env var names
  baseUrl?: string; // For openai-compatible providers
}

export interface RouteConfig {
  [route: string]: ProviderConfig[];
}

// Environment bindings
export interface Env {
  AI?: any; // Cloudflare AI binding
  PROXY_AUTH_TOKEN: string;
  ROUTES_CONFIG: string;
  [key: string]: any; // Dynamic API keys
}

// Provider response
export interface ProviderResponse {
  success: boolean;
  response?: OpenAIChatResponse;
  stream?: ReadableStream<Uint8Array>;
  error?: string;
  statusCode?: number;
}
