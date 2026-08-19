import { HarnessError } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import { requireApproval } from '../approval.js';
export function applyDeleteTool(ctx) {
    ctx.tools.register(defineTool({
        name: 'delete_workspace',
        description: 'Delete a workspace registration only (the disk directory and session logs are kept). Destructive: sessions return to ungrouped and the id becomes permanently invalid, so it requires user approval. Refuses to delete while the workspace still has un-archived sessions (archive them first).',
        parameters: {
            workspace_id: {
                type: 'string',
                required: true,
                description: 'The workspace record id to delete.',
            },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    deleted: {
                        type: 'boolean',
                        required: true,
                        description: 'true when a record was deleted; false for an unknown id (idempotent).',
                    },
                    note: {
                        type: 'string',
                        description: 'Model-facing explanation.',
                    },
                },
            },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args, exec) {
            const id = WorkspaceId(args.workspace_id);
            const ws = ctx.workspaceRegistry.get(id);
            if (ws === undefined) {
                // 未知 id：幂等 no-op，无破坏性，无需审批。
                return { deleted: false, note: '未知工作区 id，未删除任何记录（幂等）。' };
            }
            // 有未归档会话时禁止删除：删除会使这些会话脱组（回到未分组）且工作区 id
            // 永久失效，必须先归档（或迁移）这些会话后再删除。此守卫先于审批，命中即
            // 拒绝，不消耗一次审批弹窗。
            const archived = new Set(ctx.workspaceRegistry.archivedSessionIds);
            const activeSessionIds = ws.sessionIds.filter((sid) => !archived.has(sid));
            if (activeSessionIds.length > 0) {
                throw new HarnessError("无法删除工作区 '" + ws.title + "'（" + ws.path + "）：其下仍有 " + activeSessionIds.length +
                    ' 个未归档会话，请先归档这些会话后再删除。', 'WORKSPACE_HAS_ACTIVE_SESSIONS');
            }
            await requireApproval(ctx, exec, 'delete_workspace', "删除工作区注册 '" + ws.title + "'（" + ws.path + "）；磁盘目录与会话日志不会被删除。");
            const deleted = await ctx.workspaceRegistry.delete(id);
            return { deleted, note: '已删除工作区注册；磁盘目录与会话日志未被删除。' };
        },
        presentCall: (args) => ({ card: 'generic', title: '删除工作区注册', kind: 'delete', rawInput: args.workspace_id }),
    }));
}
