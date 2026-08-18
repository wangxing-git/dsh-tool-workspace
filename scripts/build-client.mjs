import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })
await build({
  entryPoints: ['src/client.ts'],
  bundle: true,
  format: 'cjs',
  // JSX 走 automatic runtime（react/jsx-runtime），与 ui-tool / ui-skill 官方 bundle 一致。
  jsx: 'automatic',
  // react、primitives 由宿主 __ModuleLoader__ 提供，不打包进产物；type-only import
  // （runtime/tool 的类型）会被擦除，无需 external。
  external: [
    '@deepseek-ai/dsh-client-runtime/client',
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  // __ModuleLoader__ 契约：注册 id 必须与 loader 行 id（dsh-tool-workspace）一致，
  // client-modules 按行 id 校验 bundle 是否注册，不一致会报 "loaded without registering"。
  // CJS 前奏（module/exports 声明）必须在 factory 闭包内自行提供——参照
  // @deepseek-ai/dsh-client-modules 官方 bundle 格式。
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-tool-workspace', factory: (require) => {\n" +
      "var module = { exports: {} };\n" +
      "var exports = module.exports;\n" +
      "Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });",
  },
  footer: { js: 'return module.exports; } });' },
  outfile: 'lib/client.js',
  logLevel: 'info',
})
