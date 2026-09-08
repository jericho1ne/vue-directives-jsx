#!/usr/bin/env node

import { transformSync } from '@babel/core'
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import process from 'node:process'
import type ts from 'typescript'
import directives from './index.js'

type TypeScript = typeof ts

const GENERATED_DIRECTORY = '.vue-directives-tsc'
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.mtsx', '.cts', '.ctsx'])

function projectPath(argv: string[]): string {
  const index = argv.findIndex((arg) => arg === '--project' || arg === '-p')
  if (index >= 0) {
    const project = argv[index + 1]
    if (!project) throw new Error(`${argv[index]} requires a tsconfig path.`)
    return resolve(project)
  }
  return resolve('tsconfig.json')
}

function loadTypeScript(): TypeScript {
  const requireFromProject = createRequire(join(process.cwd(), 'vue-directives-jsx-typecheck.cjs'))
  return requireFromProject('typescript') as TypeScript
}

function generatedPath(fileName: string, projectDirectory: string, generatedDirectory: string): string {
  const pathFromProject = relative(projectDirectory, fileName)
  return pathFromProject.startsWith('..') || isAbsolute(pathFromProject)
    ? fileName
    : join(generatedDirectory, pathFromProject)
}

async function transformSource(fileName: string): Promise<string> {
  const source = await readFile(fileName, 'utf8')
  const result = transformSync(source, {
    babelrc: false,
    configFile: false,
    filename: fileName,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [directives],
  })
  return result?.code ?? source
}

function report(ts: TypeScript, diagnostics: readonly ts.Diagnostic[]): void {
  if (diagnostics.length === 0) return
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  }))
}

async function main(): Promise<void> {
  const ts = loadTypeScript()
  const configPath = projectPath(process.argv.slice(2))
  const projectDirectory = dirname(configPath)
  const generatedDirectory = join(projectDirectory, GENERATED_DIRECTORY)
  const config = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      report(ts, [diagnostic])
    },
  })

  if (!config) throw new Error(`Could not read ${configPath}.`)
  if (config.errors.length > 0) {
    report(ts, config.errors)
    process.exitCode = 1
    return
  }

  await rm(generatedDirectory, { force: true, recursive: true })
  try {
    const sourceFiles = config.fileNames.filter((fileName) => sourceExtensions.has(extname(fileName)))
    for (const fileName of sourceFiles) {
      const output = generatedPath(fileName, projectDirectory, generatedDirectory)
      if (output === fileName) continue
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, await transformSource(fileName))
    }

    const rootNames = config.fileNames.map((fileName) => (
      sourceExtensions.has(extname(fileName))
        ? generatedPath(fileName, projectDirectory, generatedDirectory)
        : fileName
    ))
    const program = ts.createProgram({
      rootNames,
      options: config.options,
      projectReferences: config.projectReferences,
    })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    report(ts, diagnostics)
    if (diagnostics.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
      process.exitCode = 1
    }
  } finally {
    await rm(generatedDirectory, { force: true, recursive: true })
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
