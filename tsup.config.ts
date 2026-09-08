import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  cjsInterop: true,
  dts: false,
  entry: ['src/index.ts', 'src/jsx.ts', 'src/typecheck.ts', 'src/vite.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  sourcemap: true,
  splitting: false,
  target: 'node18',
})
