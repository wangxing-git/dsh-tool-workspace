import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.js'
import { createMockApproval, createMockContext, mockAgent, mockExec, type MockContext } from './helpers.js'

/** 用给定目录与审批装配插件，返回可断言的 mock 上下文。 */
function boot(knownDirs: string[] = [], approval?: ReturnType<typeof createMockApproval>): MockContext {
  const mock = createMockContext(knownDirs, approval)
  apply(mock.ctx, {})
  return mock
}

/** 取出已注册工具的 execute 函数。 */
function toolOf(mock: MockContext, name: string) {
  const found = mock.tools.find((t) => t.name === name)
  if (found === undefined) throw new Error('tool not registered: ' + name)
  return found.execute
}

describe('apply 编排', () => {
  it('注册 6 个工作区工具并注入系统提示词段落', () => {
    const mock = boot()
    const names = mock.tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'create_workspace',
      'delete_workspace',
      'get_current_workspace',
      'get_workspace',
      'list_workspaces',
      'rename_workspace',
    ].sort())
    expect(mock.sections.some((s) => s.name === 'tool:workspace')).toBe(true)
  })
})

describe('list_workspaces', () => {
  it('返回静态字段与关联会话数；默认不触发目录 status 检查', async () => {
    const mock = boot(['/a'])
    const ws = await mock.registry.create('/a', 'Alpha')
    ws.sessionIds.push('sess-1', 'sess-2')
    const list = toolOf(mock, 'list_workspaces')
    const result = await list({}, mockExec(mockAgent()))
    expect(result.workspaces).toHaveLength(1)
    const item = result.workspaces[0]
    expect(item).toMatchObject({
      id: ws.id,
      path: '/a',
      title: 'Alpha',
      sessionCount: 2,
      sessionIds: ['sess-1', 'sess-2'],
    })
    expect(item.status).toBeUndefined()
  })

  it('include_status 时逐项附实时目录状态', async () => {
    const mock = boot(['/a'])
    await mock.registry.create('/a', 'Alpha')
    const result = await toolOf(mock, 'list_workspaces')({ include_status: true }, mockExec(mockAgent()))
    expect(result.workspaces[0].status).toBe('ok')
  })
})

describe('get_current_workspace', () => {
  it('当前会话目录已注册时返回对应工作区与 session_cwd', async () => {
    const mock = boot(['/ws'])
    const ws = await mock.registry.create('/ws', 'Ws')
    const result = await toolOf(mock, 'get_current_workspace')({}, mockExec(mockAgent()))
    expect(result.workspace).toMatchObject({ id: ws.id, path: '/ws', title: 'Ws' })
    expect(result.session_cwd).toBe('/ws')
    expect(result.workspace.status).toBeUndefined()
  })

  it('include_status 时附实时目录状态', async () => {
    const mock = boot(['/ws'])
    await mock.registry.create('/ws', 'Ws')
    const result = await toolOf(mock, 'get_current_workspace')({ include_status: true }, mockExec(mockAgent()))
    expect(result.workspace.status).toBe('ok')
  })

  it('当前会话目录未注册时 workspace 为 null 但仍带回 session_cwd', async () => {
    const mock = boot(['/other'])
    await mock.registry.create('/other', 'Other')
    const result = await toolOf(mock, 'get_current_workspace')({}, mockExec(mockAgent()))
    expect(result.workspace).toBeNull()
    expect(result.session_cwd).toBe('/ws')
  })

  it('agent-less 调用返回 null workspace 与 null session_cwd', async () => {
    const mock = boot(['/ws'])
    await mock.registry.create('/ws', 'Ws')
    const result = await toolOf(mock, 'get_current_workspace')({}, mockExec(undefined))
    expect(result.workspace).toBeNull()
    expect(result.session_cwd).toBeNull()
  })
})

describe('get_workspace', () => {
  it('按 id 返回详情（含实时 status）', async () => {
    const mock = boot(['/a'])
    const ws = await mock.registry.create('/a', 'Alpha')
    const result = await toolOf(mock, 'get_workspace')({ workspace_id: ws.id }, mockExec(mockAgent()))
    expect(result.workspace.id).toBe(ws.id)
    expect(result.workspace.status).toBe('ok')
  })

  it('未知 id 抛 WORKSPACE_NOT_FOUND', async () => {
    const mock = boot()
    await expect(
      toolOf(mock, 'get_workspace')({ workspace_id: 'nope' }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' })
  })
})

describe('create_workspace', () => {
  it('登记已存在目录并返回记录', async () => {
    const mock = boot(['/new'])
    const result = await toolOf(mock, 'create_workspace')({ path: '/new', title: 'New' }, mockExec(mockAgent()))
    expect(result.reused).toBe(false)
    expect(result.workspace.path).toBe('/new')
    expect(result.workspace.title).toBe('New')
  })

  it('同一路径二次登记复用既有记录且不改标题', async () => {
    const mock = boot(['/dup'])
    await mock.registry.create('/dup', 'Original')
    const result = await toolOf(mock, 'create_workspace')({ path: '/dup', title: 'Changed' }, mockExec(mockAgent()))
    expect(result.reused).toBe(true)
    expect(result.workspace.title).toBe('Original')
  })

  it('路径不存在或非目录抛 WORKSPACE_PATH_INVALID', async () => {
    const mock = boot([])
    await expect(
      toolOf(mock, 'create_workspace')({ path: '/missing' }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_PATH_INVALID' })
  })
})

describe('rename_workspace', () => {
  it('仅改标题时不触发审批', async () => {
    const approval = createMockApproval('rejected')
    const mock = boot(['/a'], approval)
    const ws = await mock.registry.create('/a', 'Old')
    const result = await toolOf(mock, 'rename_workspace')(
      { workspace_id: ws.id, new_title: 'New' },
      mockExec(mockAgent()),
    )
    expect(result.repointed).toBe(false)
    expect(result.workspace.title).toBe('New')
    expect(approval.requests).toHaveLength(0)
  })

  it('改路径在 approved 下删除旧注册并新建注册', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a', '/b'], approval)
    const ws = await mock.registry.create('/a', 'Alpha')
    const result = await toolOf(mock, 'rename_workspace')(
      { workspace_id: ws.id, new_path: '/b' },
      mockExec(mockAgent()),
    )
    expect(result.repointed).toBe(true)
    expect(result.workspace.path).toBe('/b')
    expect(result.workspace.title).toBe('Alpha')
    expect(mock.registry.get(ws.id)).toBeUndefined()
    expect(approval.requests).toHaveLength(1)
  })

  it('改路径时新建注册失败则保留旧注册（先建后删）', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a', '/b'], approval)
    const ws = await mock.registry.create('/a', 'Alpha')
    mock.registry.createError = new Error('simulated storage failure')
    await expect(
      toolOf(mock, 'rename_workspace')({ workspace_id: ws.id, new_path: '/b' }, mockExec(mockAgent())),
    ).rejects.toThrow('simulated storage failure')
    expect(mock.registry.get(ws.id)).toBeDefined()
    expect(mock.registry.get(ws.id)?.path).toBe('/a')
  })

  it('改路径被拒绝时抛错且旧注册保留', async () => {
    const approval = createMockApproval('rejected')
    const mock = boot(['/a', '/b'], approval)
    const ws = await mock.registry.create('/a', 'Alpha')
    await expect(
      toolOf(mock, 'rename_workspace')({ workspace_id: ws.id, new_path: '/b' }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_APPROVAL_DENIED' })
    expect(mock.registry.get(ws.id)).toBeDefined()
  })

  it('无审批服务时改路径 fail-closed', async () => {
    const mock = boot(['/a', '/b'], undefined)
    const ws = await mock.registry.create('/a', 'Alpha')
    await expect(
      toolOf(mock, 'rename_workspace')({ workspace_id: ws.id, new_path: '/b' }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_APPROVAL_UNAVAILABLE' })
    expect(mock.registry.get(ws.id)).toBeDefined()
  })

  it('agent-less 调用改路径 fail-closed', async () => {
    const mock = boot(['/a', '/b'], createMockApproval('allowed-once'))
    const ws = await mock.registry.create('/a', 'Alpha')
    await expect(
      toolOf(mock, 'rename_workspace')({ workspace_id: ws.id, new_path: '/b' }, mockExec(undefined)),
    ).rejects.toMatchObject({ code: 'WORKSPACE_APPROVAL_UNAVAILABLE' })
    expect(mock.registry.get(ws.id)).toBeDefined()
  })

  it('改路径到不存在的目录抛 WORKSPACE_PATH_INVALID（且不触发审批）', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a'], approval)
    const ws = await mock.registry.create('/a', 'Alpha')
    await expect(
      toolOf(mock, 'rename_workspace')({ workspace_id: ws.id, new_path: '/missing' }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_PATH_INVALID' })
    expect(approval.requests).toHaveLength(0)
  })

  it('改路径到已被其他工作区注册的目录抛 WORKSPACE_PATH_CONFLICT', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a', '/b'], approval)
    const a = await mock.registry.create('/a', 'Alpha')
    await mock.registry.create('/b', 'Beta')
    await expect(
      toolOf(mock, 'rename_workspace')({ workspace_id: a.id, new_path: '/b' }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_PATH_CONFLICT' })
    expect(approval.requests).toHaveLength(0)
  })

  it('改路径到自身退化为仅改标题', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a'], approval)
    const ws = await mock.registry.create('/a', 'Alpha')
    const result = await toolOf(mock, 'rename_workspace')(
      { workspace_id: ws.id, new_path: '/a', new_title: 'Renamed' },
      mockExec(mockAgent()),
    )
    expect(result.repointed).toBe(false)
    expect(result.workspace.title).toBe('Renamed')
    expect(approval.requests).toHaveLength(0)
  })
})

describe('delete_workspace', () => {
  it('approved 时删除注册并返回 deleted:true', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a'], approval)
    const ws = await mock.registry.create('/a', 'Alpha')
    const result = await toolOf(mock, 'delete_workspace')({ workspace_id: ws.id }, mockExec(mockAgent()))
    expect(result.deleted).toBe(true)
    expect(mock.registry.get(ws.id)).toBeUndefined()
    expect(approval.requests).toHaveLength(1)
  })

  it('rejected 时抛错且记录保留', async () => {
    const mock = boot(['/a'], createMockApproval('rejected'))
    const ws = await mock.registry.create('/a', 'Alpha')
    await expect(
      toolOf(mock, 'delete_workspace')({ workspace_id: ws.id }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_APPROVAL_DENIED' })
    expect(mock.registry.get(ws.id)).toBeDefined()
  })

  it('无审批服务时 fail-closed', async () => {
    const mock = boot(['/a'], undefined)
    const ws = await mock.registry.create('/a', 'Alpha')
    await expect(
      toolOf(mock, 'delete_workspace')({ workspace_id: ws.id }, mockExec(mockAgent())),
    ).rejects.toMatchObject({ code: 'WORKSPACE_APPROVAL_UNAVAILABLE' })
    expect(mock.registry.get(ws.id)).toBeDefined()
  })

  it('未知 id 幂等返回 deleted:false 且不触发审批', async () => {
    const approval = createMockApproval('allowed-once')
    const mock = boot(['/a'], approval)
    const result = await toolOf(mock, 'delete_workspace')({ workspace_id: 'nope' }, mockExec(mockAgent()))
    expect(result.deleted).toBe(false)
    expect(approval.requests).toHaveLength(0)
  })
})
