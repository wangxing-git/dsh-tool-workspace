import type { Workspace } from '@deepseek-ai/dsh-workspace';
/**
 * Workspace 实体 → 模型可见 JSON 的纯投影。
 * 品牌类型（WorkspaceId / SessionId）在运行时就是字符串，这里统一 String() 化，
 * 避免把品牌对象漏进 JSON 序列化。
 */
export interface WorkspaceProjection {
    id: string;
    path: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    sessionCount: number;
    sessionIds: string[];
}
/** 把 registry 实体投影为稳定的模型可见对象（不含实时的目录 status）。 */
export declare function projectWorkspace(ws: Workspace): WorkspaceProjection;
/**
 * workspace 对象的共享 output schema（status 为可选字段）。
 * 用 as const satisfies 保持精确字面量类型，让 defineTool 的 InferValue 推断出
 * 具体的 workspace 形状，而不是退化为宽泛的 JsonValue。所有工具共用这一份。
 */
export declare const WORKSPACE_OBJECT_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly id: {
            readonly type: "string";
            readonly required: true;
            readonly description: "稳定的工作区记录 id。";
        };
        readonly path: {
            readonly type: "string";
            readonly required: true;
            readonly description: "规范化后的目录绝对路径。";
        };
        readonly title: {
            readonly type: "string";
            readonly required: true;
            readonly description: "显示标题。";
        };
        readonly createdAt: {
            readonly type: "string";
            readonly required: true;
            readonly description: "ISO-8601 创建时间。";
        };
        readonly updatedAt: {
            readonly type: "string";
            readonly required: true;
            readonly description: "ISO-8601 最近一次持久化变更时间。";
        };
        readonly sessionCount: {
            readonly type: "integer";
            readonly required: true;
            readonly description: "关联会话数量。";
        };
        readonly sessionIds: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly required: true;
            readonly description: "关联会话 id 列表。";
        };
        readonly status: {
            readonly type: "string";
            readonly enum: readonly ["ok", "missing-dir"];
            readonly description: "目录当前是否存在的实时检查结果。";
        };
    };
};
