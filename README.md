# Vercel AI SDK Documentation MCP Agent

A Model Context Protocol (MCP) server that provides AI-powered search and querying capabilities for the Vercel AI SDK documentation. This project enables developers to ask questions about the Vercel AI SDK and receive accurate, contextualized responses based on the official documentation.

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- **Direct Documentation Search**: Query the Vercel AI SDK documentation index directly using similarity search
- **AI-Powered Agent**: Ask natural language questions about the Vercel AI SDK and receive comprehensive answers
- **Session Management**: Maintain conversation context across multiple queries
- **Automated Indexing**: Includes tools to fetch, process, and index the latest Vercel AI SDK documentation

## Architecture

This system consists of several key components:

1. **MCP Server**: Exposes tools via the Model Context Protocol for integration with AI assistants
2. **DocumentFetcher**: Crawls and processes the Vercel AI SDK documentation
3. **VectorStoreManager**: Creates and manages the FAISS vector index for semantic search
4. **AgentService**: Provides AI-powered answers to questions using the Google Gemini model
5. **DirectQueryService**: Offers direct semantic search of the documentation

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm
- A Google API key for Gemini model access

### Environment Variables

Create a `.env` file in the project root with the following variables:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key-here
```

You'll need to obtain a Google Gemini API key from the [Google AI Studio](https://makersuite.google.com/app/apikey).

### Installation

1. Clone the repository
   ```
   git clone https://github.com/IvanAmador/vercel-ai-docs-mcp.git
   cd vercel-ai-docs-mcp-agent
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Build the project
   ```
   npm run build
   ```

4. Build the documentation index
   ```
   npm run build:index
   ```

5. Start the MCP server
   ```
   npm run start
   ```

## Integration with Claude Desktop

[Claude Desktop](https://www.anthropic.com/claude/download) is a powerful AI assistant that supports MCP servers. To connect the Vercel AI SDK Documentation MCP agent with Claude Desktop:

1. First, install [Claude Desktop](https://www.anthropic.com/claude/download) if you don't have it already.

2. Open Claude Desktop settings (via the application menu, not within the chat interface).

3. Navigate to the "Developer" tab and click "Edit Config".

4. Add the Vercel AI Docs MCP server to your configuration:

```json
{
  "mcpServers": {
    "vercel-ai-docs": {
      "command": "node",  
      "args": ["ABSOLUTE_PATH_TO_PROJECT/dist/main.js"],
      "env": {
        "GOOGLE_GENERATIVE_AI_API_KEY": "your-google-api-key-here"
      }
    }
  }
}
```

Make sure to replace:
- `ABSOLUTE_PATH_TO_PROJECT` with the actual path to your project folder
- `your-google-api-key-here` with your Google Gemini API key

5. Save the config file and restart Claude Desktop.

6. To verify the server is connected, look for the hammer 🔨 icon in the Claude chat interface.

For more detailed information about setting up MCP servers with Claude Desktop, visit the [MCP Quickstart Guide](https://modelcontextprotocol.io/quickstart/user).

## Integration with Other MCP Clients

This MCP server is compatible with any client that implements the Model Context Protocol. Here are a few examples:

### Cursor

[Cursor](https://cursor.sh/) is an AI-powered code editor that supports MCP servers. To integrate with Cursor:

1. Add a `.cursor/mcp.json` file to your project directory (for project-specific configuration) or a `~/.cursor/mcp.json` file in your home directory (for global configuration).

2. Add the following to your configuration file:

```json
{
  "mcpServers": {
    "vercel-ai-docs": {
      "command": "node",  
      "args": ["ABSOLUTE_PATH_TO_PROJECT/dist/main.js"],
      "env": {
        "GOOGLE_GENERATIVE_AI_API_KEY": "your-google-api-key-here"
      }
    }
  }
}
```

For more information about using MCP with Cursor, refer to the [Cursor MCP documentation](https://modelcontextprotocol.io/example-clients/).

## Usage

The MCP server exposes three primary tools:

### 1. agent-query

Query the Vercel AI SDK documentation using an AI agent that can search and synthesize information.

```json
{
  "name": "agent-query",
  "arguments": {
    "query": "How do I use the streamText function?",
    "sessionId": "unique-session-id"
  }
}
```

### 2. direct-query

Perform a direct similarity search against the Vercel AI SDK documentation index.

```json
{
  "name": "direct-query",
  "arguments": {
    "query": "streamText usage",
    "limit": 5
  }
}
```

### 3. clear-memory

Clears the conversation memory for a specific session or all sessions.

```json
{
  "name": "clear-memory",
  "arguments": {
    "sessionId": "unique-session-id"
  }
}
```

To clear all sessions, omit the sessionId parameter.

## Development

### Project Structure

```
├── config/              # Configuration settings
├── core/                # Core functionality
│   ├── indexing/        # Document indexing and vector store
│   └── query/           # Query services (agent and direct)
├── files/               # Storage directories
│   ├── docs/            # Processed documentation
│   ├── faiss_index/     # Vector index files
│   └── sessions/        # Session data
├── mcp/                 # MCP server and tools
│   ├── server.ts        # MCP server implementation
│   └── tools/           # MCP tool definitions
├── scripts/             # Build and utility scripts
└── utils/               # Helper utilities
```

### Build Scripts

- `npm run build`: Compile TypeScript files
- `npm run build:index`: Build the documentation index
- `npm run dev:index`: Build and index in development mode
- `npm run dev`: Build and start in development mode

## Troubleshooting

### Common Issues

1. **Index not found or failed to load**
   
   Run `npm run build:index` to create the index before starting the server.

2. **API rate limits**
   
   When exceeding Google API rate limits, the agent service may return errors. Implement appropriate backoff strategies.

3. **Model connection issues**

   Ensure your Google API key is valid and has access to the specified Gemini model.

4. **Claude Desktop not showing MCP server**

   - Check your configuration file for syntax errors.
   - Make sure the path to the server is correct and absolute.
   - Check Claude Desktop logs for errors.
   - Restart Claude Desktop after making configuration changes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
