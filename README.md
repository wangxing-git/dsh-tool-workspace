# dsh-tool-workspace

DeepSeek Harness 的工作区管理工具集插件：向模型提供工作区注册记录的查看、创建注册、重命名、删除注册能力。

**纯注册记录语义**：所有操作只改 DSH 的 workspace 注册记录（storage），**不创建、不删除、不移动磁盘目录**。删除注册与改注册路径属于破坏性操作，执行前走用户审批（fail-closed）。

## 工具列表

| 工具 | 说明 | 审批 |
|------|------|------|
| `list_workspaces` | 列出所有工作区（id/路径/标题/时间/会话数，可选实时目录状态） | 否 |
| `get_workspace` | 按 id 查看单个工作区详情（含实时目录状态与会话 id） | 否 |
| `get_current_workspace` | 获取当前会话目录对应的已注册工作区（未注册时返回 null） | 否 |
| `create_workspace` | 把一个已存在目录注册为工作区（不创建目录） | 否 |
| `rename_workspace` | 改显示标题；或改注册路径（delete+create，新 id，会话不迁移） | 仅改路径时 |
| `delete_workspace` | 删除注册（保留磁盘目录与会话日志）；其下仍有未归档会话时拒绝删除，需先归档 | 是 |

## 权限模型

- 破坏性操作（删除注册、改注册路径）在执行前通过 `ctx.approval.request` 发起用户审批；只有 `allowed-once` 才放行，`rejected` / `cancelled` / `unavailable` 一律拒绝。
- 未挂载审批服务、或 agent-less 调用时，破坏性操作直接拒绝（fail-closed）。
- 纯注册记录模式不触碰文件系统，故不携带 `sandbox_permissions` 提权字段（该字段仅文件系统写操作使用）；破坏性操作与沙箱提权共用同一条 `approval/request` 审批通道。未来若扩展目录级操作，复用 `dsh-tool-fs` 的 FsSandboxController / `dsh-sandbox` 的 approveEscalation 即可。

## 安装与集成

1. 从 GitHub 安装到 profile（以 web 为例）：

   ```bash
   dsh plugin --profile web add github:wangxing-git/dsh-tool-workspace
   ```

   或在 `~/.dsh/profiles/web/package.json` 手动声明：

   ```json
   {
     "dsh": { "profile": { "bundles": [ "dsh-tool-workspace" ] } },
     "dependencies": { "dsh-tool-workspace": "github:wangxing-git/dsh-tool-workspace" }
   }
   ```

2. （仅手动声明时需要）在 profile 目录执行 `pnpm install`；使用 `dsh plugin add` 时内部已自动执行。
3. `dsh --profile web --dump-config` 确认插件与 6 个工具已加载。

## 开发

```bash
npm run typecheck   # 类型检查
npm test            # vitest 单元测试
npm run build       # 产出 lib/
```

## 结构

- `src/index.ts` —— 插件入口（name/inject/Config/apply 编排）
- `src/approval.ts` —— 破坏性操作的 fail-closed 审批 helper
- `src/value.ts` —— workspace 投影 + 共享 output schema
- `src/tools/*.ts` —— 6 个工具实现
- `src/client.ts` / `src/client/*` —— 客户端注入与工具调用展示（对应 `./client` 导出）
