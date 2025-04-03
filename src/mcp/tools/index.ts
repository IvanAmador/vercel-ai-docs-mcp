import { AgentService } from '../../core/query/AgentService.js';
import { DirectQueryService } from '../../core/query/DirectQueryService.js';
import { createAgentQueryTool } from './agentQueryTool.js';
import { createClearMemoryTool } from './clearMemoryTool.js';
import { createDirectQueryTool } from './directQueryTool.js';

// Function to create all tools, injecting dependencies
export function createAllMcpTools(agentService: AgentService, directQueryService: DirectQueryService) {
    return {
        agentQueryTool: createAgentQueryTool(agentService),
        directQueryTool: createDirectQueryTool(directQueryService),
        clearMemoryTool: createClearMemoryTool(agentService)
    };
}