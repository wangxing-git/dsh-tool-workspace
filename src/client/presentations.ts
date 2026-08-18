/**
 * 工作区工具的 UI 呈现注册表：为每个 wire tool name 声明专属标题、图标与
 * 折叠行摘要提取函数。组件（workspace-tool-row.tsx）按 toolName 查表渲染，
 * 新增工作区工具只需在此追加条目（注册表驱动，不侵入组件分支）。
 *
 * 本文件只依赖 primitives 图标与 react 类型，不渲染 JSX，故保持 .ts 扩展名。
 * 结构与 dsh-tool-session 的 client/presentations.ts 对齐。
 *
 * @module dsh-tool-workspace/client/presentations
 */
import type { ComponentType } from 'react'
import {
  IconEditOutline16,
  IconFolderOpenOutline16,
  IconListPenOutline16,
  IconProjectAddOutline16,
  IconSearchOutline16,
  IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

/** 工具行前导图标的最小 props 契约（对齐 primitives 图标签名）。 */
interface ToolIconProps {
  size?: number
  className?: string
}

/** 单个工作区工具的呈现配置。 */
export interface ToolPresentation {
  /** 折叠行标题（本插件固定中文文案，不接入 locale）。 */
  title: string
  /** 折叠行前导图标（以 size=14 渲染在 16px 前导框内）。 */
  icon: ComponentType<ToolIconProps>
  /** 从调用参数推导折叠行摘要；无可用参数时回退到 callId。 */
  summarize: (args: Record<string, unknown> | undefined, callId: string) => string
}

/** 取参数对象中第一个非空字符串字段（参考 ui-tool 的 pickString）。 */
function pickString(args: Record<string, unknown> | undefined, keys: readonly string[]): string | undefined {
  if (args === undefined) return undefined
  for (const key of keys) {
    const value = args[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

/** 截取首行，避免多行参数撑开折叠行。 */
function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

/** 工作区 id 摘要（get/rename/delete 等工具的核心参数）。 */
const summarizeWorkspaceId = (args: Record<string, unknown> | undefined, callId: string): string =>
  pickString(args, ['workspace_id']) ?? callId

/** include_status 打开时的折叠摘要提示。 */
const summarizeIncludeStatus = (args: Record<string, unknown> | undefined): string =>
  args?.include_status === true ? '含目录状态' : ''

/** 6 个工作区工具的呈现注册表（按 wire tool name 索引）。 */
export const WORKSPACE_TOOL_PRESENTATIONS: Readonly<Record<string, ToolPresentation>> = {
  list_workspaces: {
    title: '列出工作区',
    icon: IconListPenOutline16,
    summarize: summarizeIncludeStatus,
  },
  get_workspace: {
    title: '查看工作区',
    icon: IconSearchOutline16,
    summarize: summarizeWorkspaceId,
  },
  get_current_workspace: {
    title: '当前工作区',
    icon: IconFolderOpenOutline16,
    summarize: summarizeIncludeStatus,
  },
  create_workspace: {
    title: '注册工作区',
    icon: IconProjectAddOutline16,
    summarize: (args, callId) => firstLine(pickString(args, ['title', 'path']) ?? callId),
  },
  rename_workspace: {
    title: '重命名工作区',
    icon: IconEditOutline16,
    summarize: (args, callId) => pickString(args, ['new_title', 'new_path']) ?? summarizeWorkspaceId(args, callId),
  },
  delete_workspace: {
    title: '删除工作区',
    icon: IconTrashOutline16,
    summarize: summarizeWorkspaceId,
  },
}

/** 未收录工具名的兜底呈现（避免空白行）。 */
export const DEFAULT_PRESENTATION: ToolPresentation = {
  title: '工作区工具',
  icon: IconFolderOpenOutline16,
  summarize: summarizeWorkspaceId,
}
