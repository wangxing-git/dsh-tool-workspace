import type { Context } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import { projectWorkspace, WORKSPACE_OBJECT_SCHEMA } from '../value.js'

export function applyCreateTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'create_workspace',
    description: 'Register an existing directory as a workspace. Does not create or modify the directory. Re-registering the same canonical path returns the existing record without changing its title.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'The directory path to register (must already exist and be a directory, any path spelling).',
      },
      title: {
        type: 'string',
        description: 'Display title used only when a new record is created; defaults to the path basename.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workspace: WORKSPACE_OBJECT_SCHEMA,
          reused: {
            type: 'boolean',
            required: true,
            description: 'true when the path was already registered and the existing record was reused.',
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      // 仅「路径无效」类错误（ENOENT/ENOTDIR/EACCES）视为未注册，交给 create 兜底；
      // 其余异常向上传播，避免把未来 resolveByPath 可能引入的 storage 故障误当「路径未注册」。
      let existing: Workspace | undefined
      try {
        existing = await ctx.workspaceRegistry.resolveByPath(args.path)
      } catch (error) {
        if (!isPathError(error)) throw error
        existing = undefined
      }
      let ws
      try {
        ws = await ctx.workspaceRegistry.create(args.path, args.title)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new HarnessError(
          "无法注册工作区：路径 '" + args.path + "' 必须是一个已存在的目录（本工具不会创建目录）。原因：" + detail,
          'WORKSPACE_PATH_INVALID',
        )
      }
      return { workspace: projectWorkspace(ws), reused: existing !== undefined }
    },
    presentCall: (args) => ({ card: 'generic', title: '注册工作区', kind: 'other', rawInput: args.path }),
  }))
}

/**
 * 判断错误是否属于「路径无效」类（不存在/非目录/无权限）。
 * 这些错误来自 fs.realpath，意味着该路径无法注册为工作区。
 */
function isPathError(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('code' in error)) return false
  const code = String((error as { code?: unknown }).code)
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES'
}
