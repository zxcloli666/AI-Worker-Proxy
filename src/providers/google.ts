import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, ToolCall } from '../types';
import { createOpenAIResponse, StreamSession, generateId } from '../utils/response-mapper';

/**
 * Thought signatures are required by Gemini 3 for function calling.
 * We encode them into the tool call ID so they survive the round-trip
 * through OpenAI-format clients that don't know about signatures.
 *
 * Format: tsig:<base64url_signature>:<randomId>
 */
const TSIG_PREFIX = 'tsig:';

function encodeToolCallId(signature?: string): string {
  const randomPart = generateId(12);
  if (!signature) return `call_${randomPart}`;
  const encoded = btoa(signature).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${TSIG_PREFIX}${encoded}:${randomPart}`;
}

function decodeThoughtSignature(toolCallId: string): string | undefined {
  if (!toolCallId.startsWith(TSIG_PREFIX)) return undefined;
  const rest = toolCallId.slice(TSIG_PREFIX.length);
  const colonIdx = rest.lastIndexOf(':');
  if (colonIdx === -1) return undefined;
  const encoded = rest.slice(0, colonIdx);
  return atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
}

export class GoogleProvider extends BaseProvider {
  private grounding: boolean;

  constructor(model: string, baseUrl?: string, grounding = false) {
    super(model, baseUrl);
    this.grounding = grounding;
  }

  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const { systemInstruction, contents } = this.convertMessages(request.messages);

      // Build tools array
      const tools: Record<string, unknown>[] = [];

      // User-defined function declarations
      if (request.tools && request.tools.length > 0) {
        tools.push({
          functionDeclarations: request.tools.map((tool) => ({
            name: tool.function.name,
            description: tool.function.description || '',
            parameters: tool.function.parameters || {},
          })),
        });
      }

      // Google Search grounding
      if (this.grounding) {
        tools.push({ googleSearch: {} });
      }

      const config: Record<string, unknown> = {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens,
        topP: request.top_p,
      };

      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (tools.length > 0) {
        config.tools = tools;
      }

      if (request.stream) {
        return this.handleStream(ai, contents, config);
      }
      return this.handleNonStream(ai, contents, config);
    } catch (error) {
      return this.handleError(error, 'GoogleProvider');
    }
  }

  private async handleNonStream(
    ai: GoogleGenAI,
    contents: Content[],
    config: Record<string, unknown>
  ): Promise<ProviderResponse> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents,
      config,
    });

    let content = response.text || '';
    let toolCalls: ToolCall[] | undefined;

    // Extract function calls with thought signatures
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      const fcParts = parts.filter((p: Part) => p.functionCall);
      if (fcParts.length > 0) {
        toolCalls = fcParts.map((p: Part) => ({
          id: encodeToolCallId((p as Record<string, unknown>).thoughtSignature as string),
          type: 'function' as const,
          function: {
            name: p.functionCall!.name || '',
            arguments: JSON.stringify(p.functionCall!.args || {}),
          },
        }));
        content = '';
      }
    }

    const finishReason = toolCalls ? 'tool_calls' : 'stop';

    return {
      success: true,
      response: createOpenAIResponse(content, this.model, finishReason, toolCalls),
    };
  }

  private async handleStream(
    ai: GoogleGenAI,
    contents: Content[],
    config: Record<string, unknown>
  ): Promise<ProviderResponse> {
    const response = await ai.models.generateContentStream({
      model: this.model,
      contents,
      config,
    });

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const session = new StreamSession(this.model);

    (async () => {
      try {
        await writer.write(session.roleChunk());
        let hasToolCalls = false;

        for await (const chunk of response) {
          // Text content
          if (chunk.text) {
            await writer.write(session.textChunk(chunk.text));
          }

          // Function calls
          const parts = chunk.candidates?.[0]?.content?.parts;
          if (parts) {
            const fcParts = parts.filter((p: Part) => p.functionCall);
            for (let i = 0; i < fcParts.length; i++) {
              const p = fcParts[i];
              hasToolCalls = true;
              const callId = encodeToolCallId(
                (p as Record<string, unknown>).thoughtSignature as string
              );
              await writer.write(session.toolCallStartChunk(i, callId, p.functionCall!.name || ''));
              await writer.write(
                session.toolCallArgsChunk(i, JSON.stringify(p.functionCall!.args || {}))
              );
            }
          }
        }

        await writer.write(session.finishChunk(hasToolCalls ? 'tool_calls' : 'stop'));
        await writer.write(session.done());
      } catch (error) {
        console.error('[GoogleProvider] Stream error:', error);
        try {
          await writer.write(session.finishChunk('stop'));
          await writer.write(session.done());
        } catch {
          // Writer already closed
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // Already closed
        }
      }
    })();

    return { success: true, stream: readable };
  }

  /**
   * Convert OpenAI messages to Google GenAI Content format.
   * Preserves thought signatures from encoded tool call IDs.
   */
  private convertMessages(messages: OpenAIMessage[]): {
    systemInstruction?: string;
    contents: Content[];
  } {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content || '';
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content || '' }],
        });
      } else if (msg.role === 'assistant') {
        const parts: Part[] = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.tool_calls) {
          for (const toolCall of msg.tool_calls) {
            const part: Record<string, unknown> = {
              functionCall: {
                name: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments),
              },
            };
            // Restore thought signature from encoded tool call ID
            const sig = decodeThoughtSignature(toolCall.id);
            if (sig) {
              part.thoughtSignature = sig;
            }
            parts.push(part as Part);
          }
        }

        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      } else if (msg.role === 'tool') {
        // Find the function name from the matching tool call
        const functionName = messages
          .slice()
          .reverse()
          .find((m) => m.tool_calls?.some((tc) => tc.id === msg.tool_call_id))
          ?.tool_calls?.find((tc) => tc.id === msg.tool_call_id)?.function.name;

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: functionName || 'unknown',
                response: { content: msg.content || '' },
              },
            },
          ],
        });
      }
    }

    return { systemInstruction, contents };
  }
}
