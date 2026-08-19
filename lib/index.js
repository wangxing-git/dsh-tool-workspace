import z from '@deepseek-ai/schemastery';
import { applyListTool } from './tools/list.js';
import { applyGetTool } from './tools/get.js';
import { applyGetCurrentTool } from './tools/current.js';
import { applyCreateTool } from './tools/create.js';
import { applyRenameTool } from './tools/rename.js';
import { applyDeleteTool } from './tools/delete.js';
/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'tool-workspace';
/** 本插件必需的服务：工作区注册表、工具注册表、系统提示词。 */
export const inject = ['workspaceRegistry', 'tools', 'systemPrompt'];
export const Config = z.object({});
/**
 * 注册工作区管理工具集：查看列表、查看单个、创建注册、重命名、删除注册。
 * 纯注册记录语义：所有操作只改 storage 记录，不创建/删除/移动磁盘目录。
 * 破坏性操作（删除注册、改注册路径）在工具内部走 ctx.approval 审批，fail-closed。
 */
export function apply(ctx, _config = {}) {
    ctx.systemPrompt.section({
        name: 'tool:workspace',
        order: 112,
        text: '工作区工具管理 DSH 的工作区注册记录（list/get/current/create/rename/delete）。它们只改注册，不创建、不删除、不移动磁盘目录；删除注册与改注册路径是破坏性操作，会弹出用户审批，未获批准即失败。删除注册前，若工作区下仍有未归档会话则直接拒绝，需先归档这些会话。',
    });
    applyListTool(ctx);
    applyGetTool(ctx);
    applyGetCurrentTool(ctx);
    applyCreateTool(ctx);
    applyRenameTool(ctx);
    applyDeleteTool(ctx);
}
