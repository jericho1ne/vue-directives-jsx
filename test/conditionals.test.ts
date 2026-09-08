import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { transformSync } from '@babel/core'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const directives = require('../dist/index.cjs').default
const jsx = require('@babel/plugin-transform-react-jsx')

function compile(code, plugins = [directives]) {
  return transformSync(code, { filename: 'example.jsx', configFile: false, babelrc: false, plugins, sourceMaps: true })
}

function evaluate(source, values = {}, runtime = 'classic') {
  const output = compile(`module.exports = (${source});`, [
    directives,
    [jsx, { runtime }],
    require('@babel/plugin-transform-modules-commonjs'),
  ])
  const mod = { exports: {} }
  new Function('module', 'require', 'React', ...Object.keys(values), output.code)(mod, require, React, ...Object.values(values))
  return mod.exports
}

const markup = (source, values, runtime) => renderToStaticMarkup(evaluate(source, values, runtime))

for (const runtime of ['classic', 'automatic']) {
  test(`${runtime}: first truthy branch wins, with comments and whitespace`, () => {
    const source = `<><p v-if={a}>A</p> {/* separator */} <p v-else-if={b}>B</p><p v-else>C</p></>`
    assert.equal(markup(source, { a: true, b: true }, runtime), '<p>A</p>')
    assert.equal(markup(source, { a: false, b: true }, runtime), '<p>B</p>')
    assert.equal(markup(source, { a: false, b: false }, runtime), '<p>C</p>')
  })
}

test('all falsy values render nothing, including zero', () => {
  for (const value of [false, 0, '', null, undefined, NaN]) {
    assert.equal(evaluate('<p v-if={value}>hidden</p>', { value }), null)
  }
  assert.equal(markup('<p v-if={value}>shown</p>', { value: [] }), '<p>shown</p>')
})

test('conditions and branch contents are lazy and evaluated once', () => {
  const seen = []
  const record = (name, value) => {
    seen.push(name)
    return value
  }
  const source = `<><p v-if={record('a', false)}>{record('hidden', 'A')}</p>
    <p v-else-if={record('b', true)}>{record('shown', 'B')}</p>
    <p v-else-if={record('c', true)}>C</p></>`
  assert.equal(markup(source, { record }), '<p>B</p>')
  assert.deepEqual(seen, ['a', 'b', 'shown'])
})

test('nested branches in else and else-if, and independent chains', () => {
  const source = `<main><section v-if={false}>A</section>
    <section v-else-if={false}><i v-if={true}>B</i><i v-else>C</i></section>
    <section v-else><i v-if={false}>D</i><i v-else>E</i></section>
    <b v-if={false}>F</b><b v-else>G</b></main>`
  assert.equal(markup(source), '<main><section><i>E</i></section><b>G</b></main>')
})

test('root, return, JSX props, arrays, and expression containers', () => {
  assert.equal(markup('(() => <b v-if={true}>root</b>)()'), '<b>root</b>')
  assert.equal(markup('<div>{<b v-if={false}>no</b>}</div>'), '<div></div>')
  assert.equal(markup('[<b key="a" v-if={true}>array</b>]'), '<b>array</b>')
  const Slot = ({ content }) => content
  assert.equal(markup('<Slot content={<i v-if={true}>prop</i>} />', { Slot }), '<i>prop</i>')
})

test('explicit Fragment and member-expression components preserve props and keys', () => {
  const UI = { Block: ({ children }) => React.createElement('article', null, children) }
  const element = evaluate('<UI.Block v-if={true} {...props}>ok</UI.Block>', { UI, props: { key: 'stable', title: 'kept' } })
  assert.equal(element.key, 'stable')
  assert.equal(element.props.title, 'kept')
  assert.equal(markup('<React.Fragment v-if={true}><b>A</b><i>B</i></React.Fragment>'), '<b>A</b><i>B</i>')
})

test('ordinary JSX, text, and attributes survive unchanged', () => {
  assert.equal(markup('<p data-version="v-if">Before <b v-if={true}>yes</b> after</p>'), '<p data-version="v-if">Before <b>yes</b> after</p>')
  assert.equal(markup('<custom-card data-value="ok" />'), '<custom-card data-value="ok"></custom-card>')
})

const errors = [
  ['<p v-if />', /requires a JSX expression/],
  ['<p v-if="false" />', /requires a JSX expression/],
  ['<p v-if={true} v-if={false} />', /only one conditional/],
  ['<p v-if={true} v-else />', /only one conditional/],
  ['<p v-else />', /must immediately follow/],
  ['<p v-else-if={true} />', /must immediately follow/],
  ['<><p v-if={true} /><p v-else-if /></>', /requires a JSX expression/],
  ['<><p v-if={true} /><p v-else={false} /></>', /must not have a value/],
  ['<><p v-if={true} />text<p v-else /></>', /must immediately follow/],
  ['<><p v-if={true} />{null}<p v-else /></>', /must immediately follow/],
  ['<><p v-if={true} /><hr /><p v-else /></>', /must immediately follow/],
  ['<><p v-if={true} /><p v-else /><p v-else /></>', /must immediately follow/],
  ['<><div><p v-if={true} /></div><p v-else /></>', /must immediately follow/],
  ['<p v-bind:title={title} />', /Unsupported directive/],
  ['<p v-iff={true} />', /Unsupported directive/],
  ['<template v-if={true}>text</template>', /Conditional <template>/],
]
for (const [source, expected] of errors) {
  test(`diagnostic: ${source}`, () => assert.throws(() => compile(source), expected))
}

test('no runtime dependency, directive leakage, or cross-file state; idempotent output', () => {
  const first = compile('const view = <p v-if={ok}>A</p>;')
  assert.doesNotMatch(first.code, /v-if|require\(|import /)
  assert.equal(compile(first.code).code, first.code)
  assert.ok(first.map.sources.includes('example.jsx'))
  assert.ok(first.map.mappings.length)
  assert.throws(() => compile('<p v-else />'), /must immediately follow/)
  assert.equal(compile('const view = <p v-if={ok}>A</p>;').code, first.code)
})

test('works when JSX lowering is listed before the directive plugin', () => {
  assert.doesNotMatch(compile('<p v-if={ok} />', [jsx, directives]).code, /v-if/)
})

test('unknown options fail clearly', () => {
  assert.throws(() => compile('<p />', [[directives, { prefix: 'x' }]]), /does not accept plugin options/)
})

test('React DOM updates unmount a false branch and reset its state', async () => {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="root"></div>')
  const oldWindow = global.window
  const oldDocument = global.document
  const oldAct = global.IS_REACT_ACT_ENVIRONMENT
  global.window = dom.window
  global.document = dom.window.document
  global.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = require('react-dom/client')
  const root = createRoot(document.getElementById('root'))
  let cleanups = 0
  function Counter() {
    const [count, setCount] = React.useState(0)
    React.useEffect(() => () => {
      cleanups++
    }, [])
    return React.createElement('button', { onClick: () => setCount(count + 1) }, String(count))
  }
  const App = evaluate('(function App({visible}) { return <><Counter v-if={visible} /><p v-else>Hidden</p></>; })', { Counter })
  try {
    await React.act(() => root.render(React.createElement(App, { visible: true })))
    await React.act(() => document.querySelector('button').click())
    assert.equal(document.querySelector('button').textContent, '1')
    await React.act(() => root.render(React.createElement(App, { visible: false })))
    assert.equal(document.querySelector('button'), null)
    assert.equal(document.querySelector('p').textContent, 'Hidden')
    assert.equal(cleanups, 1)
    await React.act(() => root.render(React.createElement(App, { visible: true })))
    assert.equal(document.querySelector('button').textContent, '0')
  } finally {
    await React.act(() => root.unmount())
    dom.window.close()
    global.window = oldWindow
    global.document = oldDocument
    global.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
