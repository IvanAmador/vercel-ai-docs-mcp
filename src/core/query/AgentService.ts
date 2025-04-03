import { google } from '@ai-sdk/google';
import { CoreMessage, LanguageModel, generateText, tool } from 'ai';
import { z } from 'zod';
import path from 'path';
import { config } from '../../config/index.js';
import { VectorStoreManager } from '../indexing/VectorStoreManager.js';
import * as sessionStore from './SessionStore.js';
import { AgentResponse } from './types.js';
import { Document } from '@langchain/core/documents';

export class AgentService {
  private vectorStoreManager: VectorStoreManager;

  constructor(vectorStoreManager: VectorStoreManager) {
     if (!vectorStoreManager.isIndexLoaded()) {
        throw new Error("AgentService requires a loaded VectorStoreManager index.");
    }
    this.vectorStoreManager = vectorStoreManager;
  }

  private createDocumentSearchTool() {
    return tool({
      description: 'Searches information in the Vercel AI SDK documentation. Use this tool exclusively to answer questions about Vercel AI SDK features, functions, usage, concepts, or code examples. Use specific technical keywords for precise results.',
      parameters: z.object({
        query: z.string().describe('The specific question or topic to search for in the Vercel AI SDK documentation (e.g., "streamText usage", "useChat hook options", "handling tool errors").')
      }),
      execute: async ({ query }) => {
        console.error(`[Agent Internal Tool] Executing document search: "${query}"`);
        try {
            const results = await this.vectorStoreManager.search(query, config.agentQueryLimitDefault);
            if (results.length === 0) {
                return { info: `No relevant documents found for query: ${query}`, query };
            }
            const formattedResults = results.map((doc: Document, i: number) => ({
                index: i + 1,
                source: doc.metadata.source ? path.basename(doc.metadata.source) : 'unknown',
                content: doc.pageContent.substring(0, 1500),
                title: doc.metadata.title || 'No title',
                url: doc.metadata.url || 'URL not available',
            }));
            return {
                results: formattedResults,
                query: query,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`[Agent Internal Tool] Error during document search for "${query}":`, error);
            return { error: `Failed to search documents for query: ${query}. Inform the user you couldn't perform the search.`, query };
        }
      }
    });
  }

  public async generateAgentResponse(
    query: string,
    sessionId: string
  ): Promise<AgentResponse> {
    console.error(`Generating agent response for session ${sessionId}, query: "${query}"`);
    const loadedMessages = await sessionStore.loadSessionMessages(sessionId);
    const currentMessages: CoreMessage[] = [
      ...loadedMessages,
      { role: 'user', content: query }
    ];

    const tools = {
      documentSearch: this.createDocumentSearchTool()
    };

    try {
      // Sem anotações de tipo explícitas aqui
      const geminiResponse = await generateText({
        model: google(config.agentModelName) as LanguageModel,
        system: `You are a specialized Vercel AI SDK consultant, possessing deep expertise in its architecture, functions, and practical application across various frameworks and server environments. Your primary function is to provide accurate, comprehensive, and code-supported answers to user queries regarding the Vercel AI SDK.

        **Core Mandate & Workflow:**

        1.  **Analyze Query:** Deconstruct the user's request to identify the core concepts, functions, patterns, or issues being asked about.
        2.  **Memory Check:** Briefly consult your short-term session memory. If you have *already* searched and synthesized a complete, accurate, and relevant answer for this *exact* query within the current session, you may use that information.
        3.  **Mandatory Documentation Search (Default):** If the memory check fails (no prior relevant search in this session, or the query differs), you **MUST** use the \`documentSearchTool\`. This is your primary method for gathering information.
            *   **Strategic Querying:** Plan your search. Do not rely on a single generic query. Instead:
                *   Identify specific SDK function/hook names (\`streamText\`, \`useChat\`, \`generateObject\`, etc.).
                *   Incorporate provider names if relevant (\`openai\`, \`anthropic\`, \`google\`).
                *   Use technical keywords related to implementation patterns (\`tool streaming\`, \`multi-step calls\`, \`Generative UI\`, \`message persistence\`, \`error handling\`).
                *   Include framework context (\`React\`, \`Svelte\`, \`Next.js\`, \`Express\`).
                *   Target specific error types or limitations if mentioned.
            *   **Iterative Search:** Consider executing *multiple*, targeted queries from different angles (e.g., one for the core function, another for a related option or error) to ensure comprehensive coverage, especially for complex questions. Aim for precision in each query.
        4.  **Synthesize Information:** Critically evaluate the search results returned by the \`documentSearchTool\`. Synthesize the information from the *most relevant* document snippets. **Do not introduce information not present in the search results or your explicit SDK Architecture Knowledge.** If the search results are insufficient or conflicting, state that clearly rather than guessing.
        5.  **Construct Response:** Generate your answer *strictly* based on the synthesized information (from search or verified memory). Adhere precisely to the **Detailed Response Structure** outlined below.

        **SDK Architecture Knowledge (Internal Context):**

        *   Core modules: AI SDK Core (\`ai\`), AI SDK UI (\`@ai-sdk/react\`, etc.), AI SDK RSC (\`ai/rsc\`), provider-specific packages (\`@ai-sdk/openai\`, etc.).
        *   Function categories: Text generation/streaming (\`generateText\`, \`streamText\`), Structured data (\`generateObject\`, \`streamObject\`), Tools/Agents (\`tool\`, \`maxSteps\`), Embeddings (\`embed\`, \`embedMany\`), Image Generation (\`generateImage\`).
        *   UI Hooks: \`useChat\`, \`useCompletion\`, \`useObject\`, \`useAssistant\` (primarily React, check docs for others).
        *   Server implementations: Next.js (App/Pages), Express, Fastify, Hono, Nest.js, Node.js HTTP.

        **Detailed Response Structure:**

        1.  **Concise Explanation:** Start by briefly explaining the relevant SDK concepts, functions, or hooks involved in the user's query, based *directly* on the search results.
        2.  **Code Examples:** Provide complete, runnable code examples (both server-side and client-side, if applicable) extracted or adapted *directly* from the search results. Clearly label filenames (e.g., \`app/api/chat/route.ts\`, \`app/page.tsx\`).
        3.  **Configuration & Options:** Highlight key configuration options or parameters relevant to the query, explaining their purpose as described in the documentation snippets.
        4.  **Error Handling / Limitations:** If relevant *and found in the search results*, include specific error handling patterns or mention known limitations/workarounds.
        5.  **Documentation Reference:** Cite the source documents used. Include the \`title\` and \`url\` (or filename if URL is unavailable) from the search result metadata. Example: "*(Source: Generating Text - /docs/ai-sdk-core/generating-text)*" or "*(Source: stream-text.ts)*".
        6.  **Provider Specifics:** If applicable and documented, explain provider-specific behaviors, optimizations (e.g., caching, reasoning), or requirements related to the query.

        **Special Topic Expertise (Utilize during Query Analysis & Search Planning):**

        *   Tool implementation patterns (server-side, client-side, hybrid, user interaction).
        *   UI streaming techniques, \`StreamData\`, message annotations, UI throttling.
        *   Multi-modal capabilities (image/document/audio inputs/outputs).
        *   Model capabilities and provider differences (tool support, object generation modes).
        *   Provider features: Anthropic Cache Control, Google Search Grounding, OpenAI Reasoning.
        *   Edge runtime considerations.
        *   TypeScript usage and type safety within the SDK.

        **Constraint:** Your primary information source **MUST** be the \`documentSearchTool\` unless recalling information from an identical query *within the same session*. Do not invent features or behaviors not supported by the retrieved documentation. If the documentation is insufficient for a complete answer, explicitly state this limitation.`,
        messages: currentMessages,
        tools,
        maxSteps: config.agentMaxSteps,
      });

      const updatedMessages: CoreMessage[] = [
        ...currentMessages,
        ...geminiResponse.response.messages,
      ];
      await sessionStore.saveSessionMessages(sessionId, updatedMessages);

      const steps = geminiResponse.steps || [];
      const finalAnswer = geminiResponse.text || "I couldn't generate a response.";

      // Abordagem mais segura com verificações de tipo
      const formattedResponse: AgentResponse = {
        answer: finalAnswer,
        rawTextResponse: geminiResponse.text,
        toolCalls: steps.flatMap(step => {
          // Verifica se toolCalls existe e é um array
          if (!step.toolCalls || !Array.isArray(step.toolCalls)) {
            return [];
          }
          
          return step.toolCalls.map(call => ({
            tool: call.toolName,
            query: (call.args && typeof call.args === 'object' && 'query' in call.args) 
              ? String(call.args.query || '') 
              : 'N/A',
            timestamp: new Date().toISOString()
          }));
        }),
        toolResults: steps.flatMap(step => {
          // Verifica se toolResults existe e é um array
          if (!step.toolResults || !Array.isArray(step.toolResults)) {
            return [];
          }
          
          return step.toolResults.map(result => {
            const baseResult = {
              tool: result.toolName,
              timestamp: new Date().toISOString()
            };
            
            if (result.toolName === 'documentSearch' && 
                result.result && 
                typeof result.result === 'object' &&
                'results' in result.result &&
                Array.isArray(result.result.results)) {
              return {
                ...baseResult,
                documents: result.result.results.map((doc: any) => ({
                  title: doc.title || 'No title',
                  url: doc.url || 'URL not available'
                }))
              };
            }
            return baseResult;
          });
        }),
        sessionId: sessionId,
        messages: updatedMessages,
      };

      console.error(`Agent response generated successfully for session ${sessionId}.`);
      return formattedResponse;

    } catch (error) {
      console.error(`Error generating agent response for session ${sessionId}:`, error);
      if (error instanceof Error && 'url' in error && 'statusCode' in error) {
          console.error(`API Call Details: URL=${(error as any).url}, Status=${(error as any).statusCode}`);
      }
      throw new Error(`Agent processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async clearSession(sessionId?: string): Promise<void> {
    if (sessionId) {
      await sessionStore.deleteSessionMessages(sessionId);
      console.error(`Cleared persistent memory for session: ${sessionId}`);
    } else {
      await sessionStore.deleteAllSessionMessages();
      console.error('Cleared persistent memory for all sessions.');
    }
  }
}