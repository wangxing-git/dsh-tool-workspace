import type { Context } from '@deepseek-ai/cordis';
/**
 * 获取「当前会话目录」对应的已注册工作区（纯只读）。
 * 判定依据：exec.agent.session.header.cwd（canonical 路径）与 workspace.path 精确相等，
 * 与 session 插件对「当前工作区」的归属判定保持一致。
 */
export declare function applyGetCurrentTool(ctx: Context): void;
