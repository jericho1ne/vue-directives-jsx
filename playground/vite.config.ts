import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { transformAsync } from '@babel/core'
import jsx from '@babel/plugin-transform-react-jsx'
import directives from '../src/index.js'

const directivesPlugin: Plugin = {
  name: 'demo-vue-directives',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.endsWith('.tsx') || id.includes('/node_modules/')) return null
    return transformAsync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      plugins: [directives, [jsx, { runtime: 'automatic' }]],
    })
  },
}

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [directivesPlugin],
}
