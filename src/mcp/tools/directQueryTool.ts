import { z } from 'zod';
import { DirectQueryService } from '../../core/query/DirectQueryService.js';
import { config } from '../../config/index.js';

type McpTextContent = { type: "text"; text: string; };

export function createDirectQueryTool(directQueryService: DirectQueryService) {
  return {
    name: "direct-query",
    description: "Perform a direct similarity search against the Vercel AI SDK documentation index.",
    inputSchema: z.object({
      query: z.string().describe("The search query."),
      limit: z.number().optional().default(config.directQueryLimitDefault).describe("Maximum number of results to return."),
    }),
    execute: async ({ query, limit }: { query: string; limit?: number; }) => {
      try {
         // Log tool execution start to stderr
        console.error(`[MCP Tool] Received direct-query: "${query}" (limit: ${limit})`);
        const results = await directQueryService.performSearch(query, limit);
        const responseContent: McpTextContent = {
            type: "text" as const,
            text: JSON.stringify(results, null, 2)
        };
        return { content: [responseContent] };
      } catch (error) {
        console.error(`[MCP Tool] Error processing direct-query "${query}":`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorContent: McpTextContent = {
            type: "text" as const,
            text: JSON.stringify({ error: `Direct query failed: ${errorMessage}` })
        };
        return { content: [errorContent], isError: true };
      }
    }
  };
}