import { z } from 'zod';
import { AgentService } from '../../core/query/AgentService.js';

type McpTextContent = { type: "text"; text: string; };

export function createAgentQueryTool(agentService: AgentService) {
  return {
    name: "agent-query",
    description: "Query the Vercel AI SDK documentation using an AI agent that can search and synthesize information. Requires a session ID for conversation history.",
    inputSchema: z.object({
      query: z.string().describe("The question or topic to ask the agent about the Vercel AI SDK."),
      sessionId: z.string().uuid().describe("Required UUID session identifier for maintaining conversation history."),
    }),
    execute: async ({ query, sessionId }: { query: string; sessionId: string; }) => {
      try {
         // Log tool execution start to stderr
        console.error(`[MCP Tool] Received agent-query for session ${sessionId}`);
        const agentResponse = await agentService.generateAgentResponse(query, sessionId);

        const responseContent: McpTextContent = {
            type: "text" as const,
            text: JSON.stringify({
                answer: agentResponse.answer,
                toolInteractions: agentResponse.toolCalls.map((tc, idx) => ({
                    call: idx + 1,
                    tool: tc.tool,
                    query: tc.query,
                    resultsSummary: agentResponse.toolResults.find(tr => tr.tool === tc.tool && tr.timestamp >= tc.timestamp)
                                      ?.documents?.map(d => ({ title: d.title, url: d.url })) ?? 'No documents found or error'
                })),
                sessionId: agentResponse.sessionId,
            }, null, 2)
        };

        return { content: [responseContent] };
      } catch (error) {
        console.error(`[MCP Tool] Error processing agent-query for session ${sessionId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorContent: McpTextContent = {
            type: "text" as const,
            text: JSON.stringify({ error: `Agent query failed: ${errorMessage}` })
        };
        return { content: [errorContent], isError: true };
      }
    }
  };
}