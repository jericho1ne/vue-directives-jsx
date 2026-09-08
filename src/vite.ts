import { transformAsync } from '@babel/core'
import type { Plugin } from 'vite'
import directives from './index.js'

/** Transforms directive JSX before Vite's React plugin compiles the file. */
export default function vueDirectivesVite(): Plugin {
  return {
    name: 'vue-directives-jsx',
    enforce: 'pre',
    async transform(code, id) {
      if (!/\.[cm]?[jt]sx?$/.test(id) || !code.includes('v-')) return null

      const result = await transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: id,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: [directives],
        sourceMaps: true,
      })
      return result?.code ? { code: result.code, map: result.map } : null
    },
  }
}
