import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { projectWorkspace, WORKSPACE_OBJECT_SCHEMA } from '../value.js'

export function applyListTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'list_workspaces',
    description: 'List all registered workspaces (id, path, title, timestamps, session count). Read-only. Optionally run a live directory existence check per workspace.',
    parameters: {
      include_status: {
        type: 'boolean',
        description: 'Whether to run a live disk-directory existence check per workspace (default false to avoid per-directory IO; when true each item also carries a status field).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workspaces: {
            type: 'array',
            required: true,
            items: WORKSPACE_OBJECT_SCHEMA,
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      const workspaces = ctx.workspaceRegistry.list()
      const projected = await Promise.all(workspaces.map(async (ws) => {
        const base = projectWorkspace(ws)
        if (args.include_status === true) {
          return { ...base, status: await ws.status() }
        }
        return base
      }))
      return { workspaces: projected }
    },
    presentCall: () => ({ card: 'generic', title: '列出工作区', kind: 'read' }),
  }))
}
