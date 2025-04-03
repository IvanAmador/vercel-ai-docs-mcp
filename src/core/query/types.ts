import { CoreMessage } from 'ai';

export interface FormattedSearchResult {
  index: number;
  source: string; // filename
  url: string;
  title: string;
  content: string;
}

export interface AgentResponse {
  answer: string;
  toolCalls: { tool: string; query: string; timestamp: string }[];
  toolResults: { tool: string; documents?: { title: string; url: string }[]; timestamp: string }[];
  sessionId?: string; // Include sessionId if provided in the request
  rawTextResponse: string; // The raw text output from the LLM
  messages: CoreMessage[]; // The final message history including the agent's response
}