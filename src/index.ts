import type {
  NodePath,
  PluginObj,
} from '@babel/core'
import type * as t from '@babel/types'
import createShowTransform from './show.js'

type ConditionalName = 'v-if' | 'v-else-if' | 'v-else'
type DirectiveName = ConditionalName | 'v-show' | 'v-for'
type ConditionalDirective = {
  name: ConditionalName
  attr: NodePath<t.JSXAttribute>
  path: NodePath<t.JSXElement>
  test?: t.Expression
}
type BabelApi = { assertVersion(version: number): void, types: typeof t }

const directiveNames: readonly DirectiveName[] = [
  'v-if',
  'v-else-if',
  'v-else',
  'v-show',
  'v-for',
]
const supported = new Set<DirectiveName>(directiveNames)

export default function vueDirectives(api: BabelApi, options: object): PluginObj {
  api.assertVersion(7)
  const t = api.types
  const transformShow = createShowTransform(t)

  if (Object.keys(options).length > 0) {
    throw new Error('vue-directives-jsx does not accept plugin options yet.')
  }

  function attributeName(attr: NodePath<t.JSXAttribute>): string {
    const name = attr.node.name
    return t.isJSXNamespacedName(name) ? `${name.namespace.name}:${name.name.name}` : name.name
  }

  function directive(path: NodePath<t.JSXElement>): ConditionalDirective | undefined {
    let found: ConditionalDirective | undefined
    const seen = new Set<string>()

    for (const attr of path.get('openingElement.attributes')) {
      if (!attr.isJSXAttribute()) continue
      const name = attributeName(attr)
      if (!name.startsWith('v-')) continue
      if (!supported.has(name as DirectiveName)) {
        throw attr.buildCodeFrameError(`Unsupported directive "${name}". Supported: ${directiveNames.join(', ')}.`)
      }

      const directiveName = name as DirectiveName
      const conditional = directiveName !== 'v-show' && directiveName !== 'v-for'
      if (conditional && found) {
        throw attr.buildCodeFrameError('Use only one conditional directive per element.')
      }
      if (seen.has(name)) throw attr.buildCodeFrameError(`Duplicate directive ${name}.`)
      seen.add(name)

      if (conditional && t.isJSXIdentifier(path.node.openingElement.name, { name: 'template' })) {
        throw attr.buildCodeFrameError('Conditional <template> blocks are not supported yet. Use an imported React Fragment component.')
      }

      const value = attr.node.value
      if (directiveName === 'v-else') {
        if (value !== null) throw attr.buildCodeFrameError('v-else must not have a value.')
      } else if (!t.isJSXExpressionContainer(value) || t.isJSXEmptyExpression(value.expression)) {
        throw attr.buildCodeFrameError(`${directiveName} requires a JSX expression, for example ${directiveName}={visible}.`)
      }

      if (conditional) {
        found = {
          name: directiveName,
          attr,
          path,
          test: value && t.isJSXExpressionContainer(value) && t.isExpression(value.expression)
            ? value.expression
            : undefined,
        }
      }
    }

    return found
  }

  function findAttribute(path: NodePath<t.JSXElement>, name: 'v-show' | 'v-for'): NodePath<t.JSXAttribute> | undefined {
    return path.get('openingElement.attributes').find((attr): attr is NodePath<t.JSXAttribute> => (
      attr.isJSXAttribute() && attributeName(attr) === name
    ))
  }

  function trivia(path: NodePath): boolean {
    return (path.isJSXText() && /^\s*$/.test(path.node.value)) ||
      (path.isJSXExpressionContainer() && t.isJSXEmptyExpression(path.node.expression))
  }

  function replace(path: NodePath<t.JSXElement>, expression: t.Expression): void {
    const child = path.listKey === 'children' &&
      (path.parentPath.isJSXElement() || path.parentPath.isJSXFragment())
    path.replaceWith(child ? t.jsxExpressionContainer(expression) : expression)
  }

  function transformLoop(path: NodePath<t.JSXElement>, attr: NodePath<t.JSXAttribute>): void {
    const value = attr.node.value
    const expression = value && t.isJSXExpressionContainer(value) ? value.expression : null
    if (!expression || !t.isBinaryExpression(expression, { operator: 'in' })) {
      throw attr.buildCodeFrameError('v-for requires item in items or (item, index) in items, with distinct identifier aliases.')
    }

    const aliases = t.isSequenceExpression(expression.left) ? expression.left.expressions : [expression.left]
    if (aliases.length > 2 || aliases.some((alias) => !t.isIdentifier(alias) || !t.isValidIdentifier(alias.name)) ||
      new Set(aliases.map((alias) => t.isIdentifier(alias) ? alias.name : '')).size !== aliases.length) {
      throw attr.buildCodeFrameError('v-for requires item in items or (item, index) in items, with distinct identifier aliases.')
    }

    attr.remove()
    path.traverse({
      Function(inner) { inner.skip() },
      'AwaitExpression|YieldExpression'(inner) {
        throw inner.buildCodeFrameError('v-for bodies must render synchronously. Resolve asynchronous values before the loop.')
      },
    })
    replace(path, t.callExpression(t.memberExpression(expression.right, t.identifier('map')), [
      t.arrowFunctionExpression(aliases.map((alias) => t.cloneNode(alias) as t.Identifier), path.node),
    ]))
  }

  function transform(path: NodePath<t.JSXElement>): void {
    const first = directive(path)
    if (!first) {
      const loop = findAttribute(path, 'v-for')
      if (loop) {
        transformLoop(path, loop)
        return
      }
      const visible = findAttribute(path, 'v-show')
      if (visible) {
        path.traverse({ JSXElement: transform })
        replace(path, transformShow(path, visible))
      }
      return
    }

    if (first.name !== 'v-if') {
      throw first.attr.buildCodeFrameError(`${first.name} must immediately follow v-if or v-else-if in the same JSX parent.`)
    }

    const isChild = path.listKey === 'children' &&
      (path.parentPath.isJSXElement() || path.parentPath.isJSXFragment())
    const branches = [first]
    const consumed: NodePath[] = []

    if (isChild) {
      const siblings = path.parentPath.get('children')
      let cursor = Number(path.key) + 1
      while (cursor < siblings.length) {
        const gap: NodePath[] = []
        while (cursor < siblings.length) {
          const sibling = siblings[cursor]
          if (!sibling || !trivia(sibling)) break
          gap.push(sibling)
          cursor++
        }
        const next = siblings[cursor]
        if (!next?.isJSXElement()) break
        const branch = directive(next)
        if (!branch || branch.name === 'v-if') break
        branches.push(branch)
        consumed.push(...gap, next)
        cursor++
        if (branch.name === 'v-else') break
      }
    }

    let result: t.Expression = t.nullLiteral()
    for (let index = branches.length - 1; index >= 0; index--) {
      const branch = branches[index]!
      branch.attr.remove()
      result = branch.name === 'v-else'
        ? branch.path.node
        : t.conditionalExpression(branch.test!, branch.path.node, result)
    }
    for (const sibling of consumed.reverse()) sibling.remove()
    replace(path, result)
  }

  return {
    name: 'vue-directives-jsx',
    manipulateOptions(_, parserOptions) {
      if (!parserOptions.plugins.includes('jsx')) parserOptions.plugins.push('jsx')
    },
    visitor: {
      Program(path) {
        path.traverse({ JSXElement: transform })
      },
    },
  }
}
