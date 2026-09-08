import type { NodePath } from '@babel/core'
import type * as t from '@babel/types'

export default function createShowTransform(types: typeof t) {
  return function transformShow(path: NodePath<t.JSXElement>, directive: NodePath<t.JSXAttribute>): t.CallExpression {
    const name = path.node.openingElement.name
    if ((name.type === 'JSXIdentifier' && name.name === 'Fragment') ||
      (name.type === 'JSXMemberExpression' && name.property.name === 'Fragment')) {
      throw directive.buildCodeFrameError('v-show needs a DOM element, not a Fragment.')
    }

    const uid = (hint: string) => path.scope.generateUidIdentifier(hint)
    const tag = uid('Tag')
    const before = uid('before')
    const visible = uid('visible')
    const after = uid('after')
    const props = uid('props')
    const key = uid('key')
    const rest = uid('rest')
    const member = (object: t.Expression, property: string) => types.memberExpression(types.cloneNode(object), types.identifier(property))
    const property = (propertyName: string, value: t.Expression) => types.objectProperty(types.stringLiteral(propertyName), value, true)

    function tagExpression(node: t.JSXIdentifier | t.JSXMemberExpression): t.Expression {
      if (types.isJSXMemberExpression(node)) return types.memberExpression(tagExpression(node.object), types.identifier(node.property.name))
      return types.identifier(node.name)
    }

    const tagValue = name.type === 'JSXIdentifier' && types.react.isCompatTag(name.name)
      ? types.stringLiteral(name.name)
      : tagExpression(name as t.JSXIdentifier | t.JSXMemberExpression)

    function object(attributes: readonly (t.JSXAttribute | t.JSXSpreadAttribute)[]): t.ObjectExpression {
      return types.objectExpression(attributes.map((attribute) => {
        if (types.isJSXSpreadAttribute(attribute)) return types.spreadElement(attribute.argument)
        if (types.isJSXNamespacedName(attribute.name)) throw path.buildCodeFrameError('Namespaced JSX props are unsupported by v-show.')
        let value: t.Expression
        if (attribute.value === null) value = types.booleanLiteral(true)
        else if (types.isJSXExpressionContainer(attribute.value) && types.isExpression(attribute.value.expression)) value = attribute.value.expression
        else if (types.isStringLiteral(attribute.value)) value = types.stringLiteral(attribute.value.value.replace(/\n\s+/g, ' '))
        else throw path.buildCodeFrameError('v-show only supports standard JSX attribute values.')
        return property(attribute.name.name, value)
      }))
    }

    const attributes = path.node.openingElement.attributes
    const index = attributes.indexOf(directive.node)
    const children = types.react.buildChildren(path.node) as t.Expression[]
    const childParams = children.map(() => uid('child'))
    const jsxName = types.jsxIdentifier(tag.name)
    const element = types.jsxElement(
      types.jsxOpeningElement(jsxName, [
        types.jsxSpreadAttribute(rest),
        types.jsxAttribute(types.jsxIdentifier('key'), types.jsxExpressionContainer(key)),
      ], children.length === 0),
      children.length > 0 ? types.jsxClosingElement(types.cloneNode(jsxName)) : null,
      childParams.map((parameter) => types.jsxExpressionContainer(types.cloneNode(parameter))),
      children.length === 0,
    )

    const value = directive.node.value
    if (!value || !types.isJSXExpressionContainer(value)) {
      throw directive.buildCodeFrameError('v-show requires a JSX expression.')
    }

    return types.callExpression(types.arrowFunctionExpression([tag, before, visible, after, ...childParams], types.blockStatement([
      types.variableDeclaration('const', [types.variableDeclarator(props, types.objectExpression([
        types.spreadElement(before),
        types.spreadElement(after),
      ]))]),
      types.ifStatement(types.unaryExpression('!', visible), types.blockStatement([
        types.expressionStatement(types.assignmentExpression('=', member(props, 'style'), types.objectExpression([
          types.spreadElement(member(props, 'style')),
          property('display', types.stringLiteral('none')),
        ]))),
      ])),
      types.variableDeclaration('const', [types.variableDeclarator(types.objectPattern([
        types.objectProperty(types.identifier('key'), key),
        types.restElement(rest),
      ]), props)]),
      types.returnStatement(element),
    ])), [
      tagValue,
      object(attributes.slice(0, index)),
      value.expression as t.Expression,
      object(attributes.slice(index + 1)),
      ...children,
    ])
  }
}
