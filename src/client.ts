/**
 * dsh-tool-workspace 客户端插件：把 6 个工作区工具的专属折叠行注册进
 * tool.call.toolview keyed slot，替换未注册时的 generic 卡片（见
 * client/workspace-tool-row.tsx）。结构对齐 dsh-tool-session 的 client.ts。
 *
 * 依赖 DSH Web 宿主注入的运行时，故类型刻意宽松（ctx: any）；组件内部保持
 * 严格类型（workspace-tool-row.tsx）。
 *
 * @module dsh-tool-workspace/client
 */
import { WorkspaceToolRow } from './client/workspace-tool-row.js'
import { WORKSPACE_TOOL_PRESENTATIONS } from './client/presentations.js'

/** 客户端插件依赖的服务：slots（注册工具视图）。 */
export const inject = ['slots']

/** 注册 6 个工作区工具的专属折叠行。 */
export function apply(ctx: any): void {
  ctx.slots.inject('tool.call.toolview', () =>
    Object.keys(WORKSPACE_TOOL_PRESENTATIONS).map((name) =>
      ctx.slots.register({ name: 'tool.call.toolview', key: name }, WorkspaceToolRow),
    ),
  )
}
