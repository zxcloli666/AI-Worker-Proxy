import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, ToolCall } from '../types';
import { createOpenAIResponse, StreamSession, generateId } from '../utils/response-mapper';

export class GoogleProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: this.model });

      const { systemInstruction, contents } = this.convertMessages(request.messages);

      const tools = request.tools
        ? [
            {
              functionDeclarations: request.tools.map((tool) => ({
                name: tool.function.name,
                description: tool.function.description || '',
                parameters: tool.function.parameters || {},
              })),
            },
          ]
        : undefined;

      const generationConfig: any = {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens,
        topP: request.top_p,
      };

      const params = { contents, systemInstruction, tools, generationConfig };

      if (request.stream) {
        return this.handleStream(model, params);
      }
      return this.handleNonStream(model, params);
    } catch (error) {
      return this.handleError(error, 'GoogleProvider');
    }
  }

  private async handleNonStream(model: any, params: any): Promise<ProviderResponse> {
    const result = await model.generateContent(params);
    const response = result.response;

    let content = '';
    let toolCalls: ToolCall[] | undefined;

    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      toolCalls = functionCalls.map((fc: any, index: number) => ({
        id: `call_${generateId(24)}`,
        type: 'function' as const,
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));
    } else {
      content = response.text();
    }

    const finishReason = toolCalls ? 'tool_calls' : 'stop';

    return {
      success: true,
      response: createOpenAIResponse(content, this.model, finishReason, toolCalls),
    };
  }

  private async handleStream(model: any, params: any): Promise<ProviderResponse> {
    const result = await model.generateContentStream(params);
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const session = new StreamSession(this.model);

    (async () => {
      try {
        await writer.write(session.roleChunk());

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            await writer.write(session.textChunk(chunkText));
          }

          const functionCalls = chunk.functionCalls();
          if (functionCalls && functionCalls.length > 0) {
            for (let i = 0; i < functionCalls.length; i++) {
              const fc = functionCalls[i];
              const callId = `call_${generateId(24)}`;
              // Send start chunk with name
              await writer.write(session.toolCallStartChunk(i, callId, fc.name));
              // Send full arguments in one chunk (Gemini doesn't stream args incrementally)
              await writer.write(session.toolCallArgsChunk(i, JSON.stringify(fc.args)));
            }
          }
        }

        // Determine finish reason based on what we received
        const finalResponse = await result.response;
        const hasFunctionCalls =
          finalResponse.functionCalls() && finalResponse.functionCalls().length > 0;
        const reason = hasFunctionCalls ? 'tool_calls' : 'stop';

        await writer.write(session.finishChunk(reason));
        await writer.write(session.done());
      } catch (error) {
        console.error('[GoogleProvider] Stream error:', error);
        try {
          await writer.write(session.finishChunk('stop'));
          await writer.write(session.done());
        } catch {
          // Writer may already be closed
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

  private convertMessages(messages: OpenAIMessage[]): {
    systemInstruction?: string;
    contents: any[];
  } {
    let systemInstruction: string | undefined;
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content || '';
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content || '' }],
        });
      } else if (msg.role === 'assistant') {
        const parts: any[] = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.tool_calls) {
          for (const toolCall of msg.tool_calls) {
            parts.push({
              functionCall: {
                name: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments),
              },
            });
          }
        }

        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      } else if (msg.role === 'tool') {
        const functionName = messages
          .slice()
          .reverse()
          .find((m) => m.tool_calls?.some((tc) => tc.id === msg.tool_call_id))
          ?.tool_calls?.find((tc) => tc.id === msg.tool_call_id)?.function.name;

        contents.push({
          role: 'function',
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
