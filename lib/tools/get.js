import { HarnessError } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import { projectWorkspace, WORKSPACE_OBJECT_SCHEMA } from '../value.js';
export function applyGetTool(ctx) {
    ctx.tools.register(defineTool({
        name: 'get_workspace',
        description: 'Read one workspace record by id, including its live directory status and associated session ids. Read-only.',
        parameters: {
            workspace_id: {
                type: 'string',
                required: true,
                description: 'The workspace record id (as returned by list_workspaces).',
            },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    workspace: WORKSPACE_OBJECT_SCHEMA,
                },
            },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args) {
            const ws = ctx.workspaceRegistry.get(WorkspaceId(args.workspace_id));
            if (ws === undefined) {
                throw new HarnessError("未找到工作区 '" + args.workspace_id + "'", 'WORKSPACE_NOT_FOUND');
            }
            return { workspace: { ...projectWorkspace(ws), status: await ws.status() } };
        },
        presentCall: (args) => ({ card: 'generic', title: '查看工作区', kind: 'read', rawInput: args.workspace_id }),
    }));
}
