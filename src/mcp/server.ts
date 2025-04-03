import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ZodRawShape } from "zod";
import { VectorStoreManager } from '../core/indexing/VectorStoreManager.js';
import { AgentService } from '../core/query/AgentService.js';
import { DirectQueryService } from '../core/query/DirectQueryService.js';
import { createAllMcpTools } from './tools/index.js';
import { config } from "../config/index.js";

type McpToolExecuteResult = Promise<{
    content: { type: "text"; text: string; }[];
    isError?: boolean;
}>;


export async function startMcpServer(): Promise<void> {
  // Log server start to stderr
  console.error('Starting Vercel AI Docs MCP Server...');

  const vectorStoreManager = new VectorStoreManager();
  const indexLoaded = await vectorStoreManager.loadIndex(); // Logs internally via console.error

  if (!indexLoaded) {
    console.error(`FAISS index not found or failed to load from ${config.indexDir}.`);
    console.error('Please run "npm run build:index" to create the index before starting the server.');
    process.exit(1);
  }

  const agentService = new AgentService(vectorStoreManager);
  const directQueryService = new DirectQueryService(vectorStoreManager);
  // Log success to stderr
  console.error('Query services initialized.');

  const server = new McpServer({
    name: "vercel-ai-docs-search",
    version: "1.0.0",
    capabilities: {
      tools: { listChanged: false },
    }
  });

  const mcpTools = createAllMcpTools(agentService, directQueryService);

  server.tool(
    mcpTools.agentQueryTool.name,
    mcpTools.agentQueryTool.description,
    mcpTools.agentQueryTool.inputSchema.shape as ZodRawShape,
    (args: { [x: string]: any }): McpToolExecuteResult => {
        return mcpTools.agentQueryTool.execute(args as { query: string; sessionId: string; });
    }
  );
   // Log registration to stderr
  console.error(`Registered MCP tool: ${mcpTools.agentQueryTool.name}`);

  server.tool(
    mcpTools.directQueryTool.name,
    mcpTools.directQueryTool.description,
    mcpTools.directQueryTool.inputSchema.shape as ZodRawShape,
    (args: { [x: string]: any }): McpToolExecuteResult => {
        return mcpTools.directQueryTool.execute(args as { query: string; limit?: number; });
    }
  );
   // Log registration to stderr
   console.error(`Registered MCP tool: ${mcpTools.directQueryTool.name}`);

  server.tool(
    mcpTools.clearMemoryTool.name,
    mcpTools.clearMemoryTool.description,
    mcpTools.clearMemoryTool.inputSchema.shape as ZodRawShape,
    (args: { [x: string]: any }): McpToolExecuteResult => {
        return mcpTools.clearMemoryTool.execute(args as { sessionId?: string; });
    }
  );
   // Log registration to stderr
  console.error(`Registered MCP tool: ${mcpTools.clearMemoryTool.name}`);

  const transport = new StdioServerTransport();
  try {
     // Log connection attempt to stderr
    console.error("Attempting to connect transport...");
    await server.connect(transport);
     // Log connection success to stderr
    console.error("MCP server transport connected successfully via stdio. Ready for requests.");
  } catch (error) {
      console.error("Failed to connect MCP server transport:", error);
      process.exit(1);
  }

  process.on('SIGINT', async () => {
      // Log shutdown to stderr
      console.error("\nReceived SIGINT, shutting down MCP server...");
      await server.close();
      console.error("MCP server closed.");
      process.exit(0);
  });

   process.on('SIGTERM', async () => {
       // Log shutdown to stderr
      console.error("\nReceived SIGTERM, shutting down MCP server...");
      await server.close();
      console.error("MCP server closed.");
      process.exit(0);
  });

  process.on('uncaughtException', (error, origin) => {
    console.error(`Uncaught Exception at: ${origin}`, error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}