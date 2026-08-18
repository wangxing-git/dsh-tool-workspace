import type { Context } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { requireApproval } from '../approval.js'
import { projectWorkspace, WORKSPACE_OBJECT_SCHEMA } from '../value.js'

/** 判断可选文本是否提供了有意义的新值。 */
function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== ''
}

export function applyRenameTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'rename_workspace',
    description: 'Rename a workspace: change its display title, or re-point its registration to another existing directory. Changing the title is direct; changing the path is destructive (deletes the old registration and creates a new one, session links are not migrated) and requires user approval.',
    parameters: {
      workspace_id: {
        type: 'string',
        required: true,
        description: 'The workspace record id to rename.',
      },
      new_title: {
        type: 'string',
        description: 'New display title (used for a title-only rename).',
      },
      new_path: {
        type: 'string',
        description: 'New registration directory (must already exist; triggers user approval).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workspace: WORKSPACE_OBJECT_SCHEMA,
          repointed: {
            type: 'boolean',
            required: true,
            description: 'true when the registration was re-pointed (old registration deleted, new one created).',
          },
          note: {
            type: 'string',
            description: 'Model-facing explanation (mentions the new id and that session links are not migrated when repointed).',
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const id = WorkspaceId(args.workspace_id)
      const ws = ctx.workspaceRegistry.get(id)
      if (ws === undefined) {
        throw new HarnessError("未找到工作区 '" + args.workspace_id + "'", 'WORKSPACE_NOT_FOUND')
      }

      const hasTitle = hasText(args.new_title)
      const hasPath = hasText(args.new_path)
      if (!hasTitle && !hasPath) {
        throw new HarnessError('rename_workspace 至少需要 new_title 或 new_path 之一', 'WORKSPACE_INVALID_ARGS')
      }

      // 只改标题：低风险，直接执行，无需审批。
      if (!hasPath) {
        await ws.setTitle(args.new_title as string)
        return { workspace: projectWorkspace(ws), repointed: false, note: '已更新显示标题。' }
      }

      // 改路径：先做无副作用的预检（目录存在性 + 冲突），再审批，最后提交。
      let existingAtNewPath
      try {
        existingAtNewPath = await ctx.workspaceRegistry.resolveByPath(args.new_path as string)
      } catch {
        throw new HarnessError(
          "无法改注册路径：'" + args.new_path + "' 必须是一个已存在的目录。",
          'WORKSPACE_PATH_INVALID',
        )
      }

      if (existingAtNewPath !== undefined && String(existingAtNewPath.id) !== args.workspace_id) {
        throw new HarnessError(
          "无法改注册路径：'" + args.new_path + "' 已被另一个工作区 '" + existingAtNewPath.title + "' 注册。",
          'WORKSPACE_PATH_CONFLICT',
        )
      }
      if (existingAtNewPath !== undefined && String(existingAtNewPath.id) === args.workspace_id) {
        // 新路径就是当前注册路径本身：退化为仅改标题（如有）。
        if (hasTitle) await ws.setTitle(args.new_title as string)
        return { workspace: projectWorkspace(ws), repointed: false, note: '新路径与当前注册路径相同，仅按需更新标题。' }
      }

      const newTitle = hasTitle ? (args.new_title as string) : ws.title
      await requireApproval(
        ctx,
        exec,
        'rename_workspace',
        "将工作区 '" + ws.title + "'（" + ws.path + "）的注册路径重新指向 '" + args.new_path + "'；旧注册将被删除，原会话关联不会迁移。",
      )

      // 先建新注册、成功后再删旧注册：把「先删后建」的不可恢复数据丢失风险
      // （旧注册已删、新注册因 storage 故障未建成）降级为「先建后删」的可恢复
      // 短暂重复注册（新建成功、旧删失败时短暂并存两条记录，可重试清理）。
      const repointed = await ctx.workspaceRegistry.create(args.new_path as string, newTitle)
      await ctx.workspaceRegistry.delete(id)
      return {
        workspace: projectWorkspace(repointed),
        repointed: true,
        note: '已删除旧注册并重新注册到新路径，生成了新的工作区 id；原会话关联(sessionIds)未自动迁移，需重新关联。',
      }
    },
    presentCall: (args) => ({ card: 'generic', title: '重命名工作区', kind: 'move', rawInput: args.workspace_id }),
  }))
}
