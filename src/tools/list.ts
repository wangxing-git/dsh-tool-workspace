import type { Context } from '@deepseek-ai/cordis'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { projectWorkspace, WORKSPACE_OBJECT_SCHEMA } from '../value.js'

export function applyListTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'list_workspaces',
    description: 'List all registered workspaces (id, path, title, timestamps, session count). Read-only. Optionally filter by a keyword (case-insensitive substring fuzzy search over id/path/title) or run a live directory existence check per workspace.',
    parameters: {
      query: {
        type: 'string',
        description: 'Optional keyword for case-insensitive substring fuzzy search across id, path, and title. When omitted or blank, all workspaces are returned.',
      },
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
      const query = normalizeQuery(args.query)
      const matches = query === '' ? workspaces : workspaces.filter((ws) => matchesQuery(ws, query))
      const projected = await Promise.all(matches.map(async (ws) => {
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

/** 归一化关键词：未提供/非字符串/空白串一律视为空（空关键词表示返回全部）。 */
function normalizeQuery(query: unknown): string {
  if (typeof query !== 'string') return ''
  return query.trim().toLowerCase()
}

/** 关键词命中判定：对 id/path/title 做大小写不敏感的子串匹配（任一命中即匹配）。 */
function matchesQuery(ws: Workspace, normalizedQuery: string): boolean {
  return (
    String(ws.id).toLowerCase().includes(normalizedQuery) ||
    ws.path.toLowerCase().includes(normalizedQuery) ||
    ws.title.toLowerCase().includes(normalizedQuery)
  )
}
