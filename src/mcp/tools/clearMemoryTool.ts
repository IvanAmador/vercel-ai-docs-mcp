import { z } from 'zod';
import { AgentService } from '../../core/query/AgentService.js';

type McpTextContent = { type: "text"; text: string; };

export function createClearMemoryTool(agentService: AgentService) {
  return {
    name: "clear-memory",
    description: "Clears the conversation memory for a specific session or all sessions.",
    inputSchema: z.object({
      sessionId: z.string().uuid().optional().describe("The UUID session identifier to clear. If omitted, clears memory for all sessions."),
    }),
    execute: async ({ sessionId }: { sessionId?: string; }) => {
      try {
         // Log tool execution start to stderr
        console.error(`[MCP Tool] Received clear-memory request for session: ${sessionId || 'ALL'}`);
        await agentService.clearSession(sessionId);
        const message = sessionId
          ? `Successfully cleared memory for session ${sessionId}.`
          : 'Successfully cleared memory for all sessions.';
        const responseContent: McpTextContent = {
            type: "text" as const,
            text: JSON.stringify({ success: true, message: message })
        };
        return { content: [responseContent] };
      } catch (error) {
        console.error(`[MCP Tool] Error processing clear-memory request for ${sessionId || 'ALL'}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
         const errorContent: McpTextContent = {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: `Failed to clear memory: ${errorMessage}` })
        };
        return { content: [errorContent], isError: true };
      }
    }
  };
}