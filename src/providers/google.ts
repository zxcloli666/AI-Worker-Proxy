import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse, OpenAIMessage, ToolCall } from '../types';
import { createOpenAIResponse, createStreamChunk } from '../utils/response-mapper';

export class GoogleProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: this.model });

      // Convert messages to Gemini format
      const { systemInstruction, contents } = this.convertMessages(request.messages);

      // Convert tools if present
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

      if (request.stream) {
        return this.handleStream(model, {
          contents,
          systemInstruction,
          tools,
          generationConfig,
        });
      } else {
        return this.handleNonStream(model, {
          contents,
          systemInstruction,
          tools,
          generationConfig,
        });
      }
    } catch (error) {
      return this.handleError(error, 'GoogleProvider');
    }
  }

  private async handleNonStream(model: any, params: any): Promise<ProviderResponse> {
    const result = await model.generateContent(params);
    const response = result.response;

    let content = '';
    let toolCalls: ToolCall[] | undefined;

    // Check for function calls
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      toolCalls = functionCalls.map((fc: any, index: number) => ({
        id: `call_${Date.now()}_${index}`,
        type: 'function',
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));
    } else {
      content = response.text();
    }

    const finishReason = toolCalls ? 'tool_calls' : 'stop';
    const openAIResponse = createOpenAIResponse(content, this.model, finishReason, toolCalls);

    return {
      success: true,
      response: openAIResponse,
    };
  }

  private async handleStream(model: any, params: any): Promise<ProviderResponse> {
    const result = await model.generateContentStream(params);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process stream in background
    (async () => {
      try {
        let isFirst = true;

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();

          if (chunkText) {
            const delta = isFirst
              ? { content: chunkText, role: 'assistant' as const }
              : { content: chunkText };

            const streamChunk = createStreamChunk(delta, this.model);
            await writer.write(encoder.encode(streamChunk));
            isFirst = false;
          }

          // Check for function calls
          const functionCalls = chunk.functionCalls();
          if (functionCalls && functionCalls.length > 0) {
            for (const [index, fc] of functionCalls.entries()) {
              const toolCall: ToolCall = {
                id: `call_${Date.now()}_${index}`,
                type: 'function',
                function: {
                  name: fc.name,
                  arguments: JSON.stringify(fc.args),
                },
              };

              const delta = isFirst
                ? { tool_calls: [toolCall], role: 'assistant' as const }
                : { tool_calls: [toolCall] };

              const streamChunk = createStreamChunk(delta, this.model);
              await writer.write(encoder.encode(streamChunk));
              isFirst = false;
            }
          }
        }

        // Send final chunk
        const finishChunk = createStreamChunk({}, this.model, 'stop');
        await writer.write(encoder.encode(finishChunk));
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        await writer.close();
      }
    })();

    return {
      success: true,
      stream: readable,
    };
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

        contents.push({
          role: 'model',
          parts,
        });
      } else if (msg.role === 'tool') {
        // Tool response
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
                response: {
                  content: msg.content || '',
                },
              },
            },
          ],
        });
      }
    }

    return { systemInstruction, contents };
  }
}
