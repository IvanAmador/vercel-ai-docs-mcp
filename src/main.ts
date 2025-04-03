import { startMcpServer } from './mcp/server.js';
import { fileURLToPath } from 'url';

async function main() {
  try {
    await startMcpServer();
    // Log process waiting message to stderr
    console.error("MCP Server setup complete. Process waiting indefinitely for transport closure or signals.");
    await new Promise(() => {});
  } catch (error) {
    console.error("Fatal error starting the application:", error);
    process.exit(1);
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && (process.argv[1] === scriptPath || process.argv[1].endsWith('/dist/main.js'));

if (isDirectRun) {
    main();
}