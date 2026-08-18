import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis 插件名，用于 loader 诊断。 */
export declare const name = "tool-workspace";
/** 本插件必需的服务：工作区注册表、工具注册表、系统提示词。 */
export declare const inject: string[];
/** 插件配置（当前为空，保留接口便于后续扩展审批开关等）。 */
export interface Config {
}
export declare const Config: z<Config>;
/**
 * 注册工作区管理工具集：查看列表、查看单个、创建注册、重命名、删除注册。
 * 纯注册记录语义：所有操作只改 storage 记录，不创建/删除/移动磁盘目录。
 * 破坏性操作（删除注册、改注册路径）在工具内部走 ctx.approval 审批，fail-closed。
 */
export declare function apply(ctx: Context, _config?: Config): void;
