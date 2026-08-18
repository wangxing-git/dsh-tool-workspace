import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { requireApproval } from '../approval.js'

export function applyDeleteTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'delete_workspace',
    description: 'Delete a workspace registration only (the disk directory and session logs are kept). Destructive: sessions return to ungrouped and the id becomes permanently invalid, so it requires user approval.',
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
      const id = WorkspaceId(args.workspace_id)
      const ws = ctx.workspaceRegistry.get(id)
      if (ws === undefined) {
        // 未知 id：幂等 no-op，无破坏性，无需审批。
        return { deleted: false, note: '未知工作区 id，未删除任何记录（幂等）。' }
      }
      await requireApproval(
        ctx,
        exec,
        'delete_workspace',
        "删除工作区注册 '" + ws.title + "'（" + ws.path + "）；磁盘目录与会话日志不会被删除。",
      )
      const deleted = await ctx.workspaceRegistry.delete(id)
      return { deleted, note: '已删除工作区注册；磁盘目录与会话日志未被删除。' }
    },
    presentCall: (args) => ({ card: 'generic', title: '删除工作区注册', kind: 'delete', rawInput: args.workspace_id }),
  }))
}
