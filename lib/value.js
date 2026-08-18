/** 把 registry 实体投影为稳定的模型可见对象（不含实时的目录 status）。 */
export function projectWorkspace(ws) {
    return {
        id: String(ws.id),
        path: ws.path,
        title: ws.title,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
        sessionCount: ws.sessionIds.length,
        sessionIds: ws.sessionIds.map((id) => String(id)),
    };
}
/**
 * workspace 对象的共享 output schema（status 为可选字段）。
 * 用 as const satisfies 保持精确字面量类型，让 defineTool 的 InferValue 推断出
 * 具体的 workspace 形状，而不是退化为宽泛的 JsonValue。所有工具共用这一份。
 */
export const WORKSPACE_OBJECT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string', required: true, description: '稳定的工作区记录 id。' },
        path: { type: 'string', required: true, description: '规范化后的目录绝对路径。' },
        title: { type: 'string', required: true, description: '显示标题。' },
        createdAt: { type: 'string', required: true, description: 'ISO-8601 创建时间。' },
        updatedAt: { type: 'string', required: true, description: 'ISO-8601 最近一次持久化变更时间。' },
        sessionCount: { type: 'integer', required: true, description: '关联会话数量。' },
        sessionIds: { type: 'array', items: { type: 'string' }, required: true, description: '关联会话 id 列表。' },
        status: { type: 'string', enum: ['ok', 'missing-dir'], description: '目录当前是否存在的实时检查结果。' },
    },
};
