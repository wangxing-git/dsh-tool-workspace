import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { projectWorkspace, WORKSPACE_OBJECT_SCHEMA } from '../value.js'

/**
 * 获取「当前会话目录」对应的已注册工作区（纯只读）。
 * 判定依据：exec.agent.session.header.cwd（canonical 路径）与 workspace.path 精确相等，
 * 与 session 插件对「当前工作区」的归属判定保持一致。
 */
export function applyGetCurrentTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'get_current_workspace',
    description: "Get the workspace registration for the current session's directory (canonical cwd). Returns the matching workspace record plus the detected session directory, or a null workspace when the session directory is not registered or no session context is available. Read-only.",
    parameters: {
      include_status: {
        type: 'boolean',
        description: 'Whether to also run a live disk-directory existence check (default false).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workspace: {
            oneOf: [WORKSPACE_OBJECT_SCHEMA, { type: 'null' }],
            required: true,
            description: 'The registered workspace owning the current session directory; null when it is not registered or no session cwd is available.',
          },
          session_cwd: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
            required: true,
            description: 'The canonical cwd of the current session used for the lookup; null when no session context is available.',
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const cwd = exec.agent?.session.header.cwd
      if (cwd === undefined || cwd === '') {
        return { workspace: null, session_cwd: null }
      }
      const ws = ctx.workspaceRegistry.list().find((w) => w.path === cwd)
      if (ws === undefined) {
        return { workspace: null, session_cwd: cwd }
      }
      const base = projectWorkspace(ws)
      if (args.include_status === true) {
        return { workspace: { ...base, status: await ws.status() }, session_cwd: cwd }
      }
      return { workspace: base, session_cwd: cwd }
    },
    presentCall: () => ({ card: 'generic', title: '获取当前工作区', kind: 'read' }),
  }))
}
