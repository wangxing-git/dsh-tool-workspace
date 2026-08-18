import { HarnessError } from '@deepseek-ai/dsh-llm';
/**
 * 破坏性工作区操作（删除注册、改注册路径）执行前的用户审批，fail-closed。
 *
 * 纯注册记录模式下，工作区工具只写 storage KV、不触碰文件系统，因此不携带
 * `sandbox_permissions`/justification（那是 dsh-tool-fs / dsh-tool-bash 文件系统
 * 写操作的提权字段）。破坏性操作的权限通过 `ctx.approval`（与沙箱提权共用同一条
 * `approval/request` 瀑布）落地：只有 `allowed-once` 才放行，其余一律拒绝。
 *
 * 未来若扩展「创建目录 / 递归删除目录 / mv 目录」等文件系统写操作，应在此处复用
 * `dsh-tool-fs` 的 FsSandboxController 或 `dsh-sandbox` 的 approveEscalation
 * （sandbox_permissions + justification），保持与官方工具一致的提权通道。
 */
export async function requireApproval(ctx, exec, toolName, reason) {
    const approval = ctx.get('approval');
    if (approval === undefined) {
        throw new HarnessError('无法执行破坏性工作区操作：当前组合未挂载审批服务(approval)，操作已被拒绝。', 'WORKSPACE_APPROVAL_UNAVAILABLE');
    }
    if (exec.agent === undefined) {
        throw new HarnessError('无法执行破坏性工作区操作：本次调用没有关联会话(agent)，无法发起审批，操作已被拒绝。', 'WORKSPACE_APPROVAL_UNAVAILABLE');
    }
    const outcome = await approval.request({
        agent: exec.agent,
        toolName,
        callId: exec.callId,
        reason,
        signal: exec.signal,
    });
    if (outcome !== 'allowed-once') {
        const message = outcome === 'rejected'
            ? '工作区操作被用户拒绝。'
            : outcome === 'cancelled'
                ? '工作区操作审批被取消。'
                : '工作区操作审批不可用（unavailable）。';
        throw new HarnessError(message, 'WORKSPACE_APPROVAL_DENIED');
    }
}
