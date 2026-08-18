/**
 * 测试辅助：最小可用的 mock Context / workspaceRegistry / approval。
 * 参照 dsh-autogate 的测试做法——用宽松类型构造 mock，捕获 tools.register 定义后直接调用其 execute。
 */

export interface MockWorkspace {
  id: string
  path: string
  title: string
  createdAt: string
  updatedAt: string
  sessionIds: string[]
  setTitle: (title: string) => Promise<void>
  status: () => Promise<'ok' | 'missing-dir'>
}

export interface MockRegistry {
  records: Map<string, MockWorkspace>
  /** 被视为「已存在」的目录路径（resolveByPath/create 对不在其中的路径抛错，模拟 realpath ENOENT）。 */
  knownDirs: Set<string>
  list: () => MockWorkspace[]
  get: (id: string) => MockWorkspace | undefined
  create: (path: string, title?: string) => Promise<MockWorkspace>
  delete: (id: string) => Promise<boolean>
  resolveByPath: (path: string) => Promise<MockWorkspace | undefined>
  /** 置为非空时，下一次 create 抛出该错误（模拟 storage 故障，一次性消费）。 */
  createError: Error | undefined
}

/** 模拟 fs.realpath 对不存在路径抛出的 ErrnoException（带 code 字段）。 */
function enoent(path: string): Error {
  const err = new Error("ENOENT: no such directory, realpath '" + path + "'")
  ;(err as { code?: string }).code = 'ENOENT'
  return err
}

export function createMockRegistry(knownDirs: string[] = []): MockRegistry {
  const records = new Map<string, MockWorkspace>()
  const knownDirsSet = new Set(knownDirs)
  let nextId = 1
  let createError: Error | undefined = undefined

  const makeWorkspace = (path: string, title?: string): MockWorkspace => {
    const ws: MockWorkspace = {
      id: 'ws-' + nextId++,
      path,
      title: title ?? (path.split('/').pop() || path),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sessionIds: [],
      setTitle: async (t: string) => { ws.title = t },
      status: async () => 'ok',
    }
    return ws
  }

  return {
    records,
    knownDirs: knownDirsSet,
    get createError() { return createError },
    set createError(value: Error | undefined) { createError = value },
    list: () => [...records.values()],
    get: (id: string) => records.get(String(id)),
    create: async (path: string, title?: string) => {
      if (createError !== undefined) {
        const err = createError
        createError = undefined
        throw err
      }
      const existing = [...records.values()].find((r) => r.path === path)
      if (existing !== undefined) return existing
      if (!knownDirsSet.has(path)) {
        throw enoent(path)
      }
      const ws = makeWorkspace(path, title)
      records.set(ws.id, ws)
      return ws
    },
    delete: async (id: string) => {
      const key = String(id)
      if (!records.has(key)) return false
      records.delete(key)
      return true
    },
    resolveByPath: async (path: string) => {
      if (!knownDirsSet.has(path)) {
        throw enoent(path)
      }
      return [...records.values()].find((r) => r.path === path)
    },
  }
}

export interface MockApproval {
  request: (req: unknown) => Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>
  requests: unknown[]
}

export function createMockApproval(outcome: 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'): MockApproval {
  const requests: unknown[] = []
  return {
    request: async (req: unknown) => {
      requests.push(req)
      return outcome
    },
    requests,
  }
}

export interface CapturedTool {
  name: string
  execute: (args: any, exec: any) => Promise<any>
}

export interface MockContext {
  ctx: any
  registry: MockRegistry
  approval: MockApproval | undefined
  tools: CapturedTool[]
  sections: { name: string; order: number; text: string }[]
  setApproval: (a: MockApproval | undefined) => void
}

export function createMockContext(knownDirs: string[] = [], approval?: MockApproval): MockContext {
  const registry = createMockRegistry(knownDirs)
  const tools: CapturedTool[] = []
  const sections: { name: string; order: number; text: string }[] = []
  let currentApproval = approval

  const ctx: any = {
    workspaceRegistry: registry,
    tools: {
      register(def: any) {
        tools.push({ name: def.name, execute: def.execute })
        return () => {}
      },
      guard() { return () => {} },
    },
    systemPrompt: {
      section(s: { name: string; order: number; text: string }) {
        sections.push(s)
      },
    },
    get(name: string) {
      if (name === 'approval') return currentApproval
      return undefined
    },
    inject() {},
    effect() { return () => {} },
    logger: { warn() {}, error() {}, info() {}, debug() {} },
    on() {},
    emit() {},
  }

  return {
    ctx,
    registry,
    get approval() { return currentApproval },
    tools,
    sections,
    setApproval(a: MockApproval | undefined) { currentApproval = a },
  }
}

export function mockAgent(): any {
  return { session: { header: { cwd: '/ws', id: 'sess-1' } } }
}

export function mockExec(agent?: any): any {
  return {
    agent,
    callId: 'call-1',
    signal: new AbortController().signal,
    deferContext() {},
    concludeTurn() {},
  }
}
