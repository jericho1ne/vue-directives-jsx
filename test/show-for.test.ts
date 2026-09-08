import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { transformSync } from '@babel/core'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const directives = require('../dist/index.cjs').default
const jsx = require('@babel/plugin-transform-react-jsx')
function compile(source, runtime = 'classic') {
  return transformSync(source, { filename: 'example.jsx', configFile: false, babelrc: false, plugins: [directives, [jsx, { runtime }], require('@babel/plugin-transform-modules-commonjs')] }).code
}
function value(source, values = {}, runtime) {
  const mod = { exports: {} }
  new Function('module', 'require', 'React', ...Object.keys(values), compile(`module.exports = (${source});`, runtime))(
    mod,
    require,
    React,
    ...Object.values(values),
  )
  return mod.exports
}
const html = (source, values, runtime) => renderToStaticMarkup(value(source, values, runtime))

for (const runtime of ['classic', 'automatic']) {
  test(`${runtime}: show preserves style, key, ref, props and children`, () => {
    const style = Object.freeze({ display: 'flex', color: 'red' })
    const ref = React.createRef()
    const source = '<div key="a" {...props} v-show={shown}>before <b>child</b> after</div>'
    const props = { style, title: 'hello', ref, key: 'b' }
    const visible = value(source, { props, shown: true }, runtime)
    const hidden = value(source, { props, shown: false }, runtime)
    assert.equal(visible.props.style, style)
    assert.equal(hidden.key, 'b')
    assert.equal(hidden.props.ref, ref)
    assert.equal(hidden.props.title, 'hello')
    assert.deepEqual(hidden.props.style, { display: 'none', color: 'red' })
    assert.equal(style.display, 'flex')
    assert.match(renderToStaticMarkup(hidden), /before <b>child<\/b> after/)
  })
  test(`${runtime}: loops compose with show and if`, () => {
    const source = '<ul><li v-if={enabled} v-for={(item, index) in items} v-show={item.active} key={item.id}>{index}:{item.name}</li><li v-else>disabled</li></ul>'
    const items = [{ id: 1, name: 'A', active: true }, { id: 2, name: 'B', active: false }]
    assert.equal(html(source, { enabled: true, items }, runtime), '<ul><li>0:A</li><li style="display:none">1:B</li></ul>')
    assert.equal(html(source, { enabled: false, items: null }, runtime), '<ul><li>disabled</li></ul>')
  })
}

test('show evaluates tag, props, spreads/getters, condition and children once in source order', () => {
  const seen = []
  const read = (name, result) => {
    seen.push(name)
    return result
  }
  const UI = { get Box() {
    seen.push('tag')
    return 'div'
  } }
  const props = {
    get title() {
      seen.push('getter')
      return 'title'
    },
    style: { display: 'grid' },
  }
  const result = value('<UI.Box id={read("id", "a")} {...read("spread", props)} v-show={read("show", false)} data-x={read("last", 1)}>{read("child", "ok")}</UI.Box>', { read, UI, props })
  assert.deepEqual(seen, ['tag', 'id', 'spread', 'getter', 'show', 'last', 'child'])
  assert.equal(result.props.style.display, 'none')
})

test('show respects last-prop-wins and nullish styles', () => {
  const props = { style: { display: 'grid' } }
  assert.equal(value('<p style={{display: "flex"}} v-show={true} {...props} />', { props }).props.style.display, 'grid')
  assert.equal(value('<p {...props} v-show={true} style={{display: "flex"}} />', { props }).props.style.display, 'flex')
  for (const style of [undefined, null]) {
    assert.equal(value('<p style={style} v-show={true} />', { style }).props.style, style)
    assert.deepEqual(value('<p style={style} v-show={false} />', { style }).props.style, { display: 'none' })
  }
  assert.deepEqual(value('<p v-show={false} />').props.style, { display: 'none' })
})

test('show composes with nested condition chains and JSX-valued props', () => {
  assert.equal(html('<div v-show={false}><b v-if={false}>A</b><b v-else>B</b></div>'), '<div style="display:none"><b>B</b></div>')
  const Box = ({ content, style }) => React.createElement('aside', { style }, content)
  assert.equal(html('<Box content={<b v-if={true}>nested</b>} v-show={false} />', { Box }), '<aside style="display:none"><b>nested</b></aside>')
  assert.equal(value('<p children="from prop" v-show={true} />').props.children, 'from prop')
  assert.equal(value('<p children="from prop" v-show={true}>child</p>').props.children, 'child')
})

test('show preserves await and lexical expressions in the caller', async () => {
  const fn = value('(async function() { return <p v-show={await Promise.resolve(true)}>{await Promise.resolve(this.text)}</p>; })')
  assert.equal((await fn.call({ text: 'ok' })).props.children, 'ok')
})

test('show normalizes literal attributes like Babel JSX', () => {
  assert.equal(value('<p title="hello\n  world" disabled v-show={true} />').props.title, 'hello world')
  assert.equal(value('<p disabled v-show={true} />').props.disabled, true)
})

test('loops support roots, index aliases, empty arrays, nested loops and explicit keyed fragments', () => {
  assert.deepEqual(value('<p v-for={item in items} key={item}>{item}</p>', { items: [] }), [])
  const result = value('<p v-for={(item, index) in items} key={item}>{index}:{item}</p>', { items: ['a', 'b'] })
  assert.deepEqual(result.map((x) => x.key), ['a', 'b'])
  assert.equal(renderToStaticMarkup(result), '<p>0:a</p><p>1:b</p>')
  assert.equal(html('<React.Fragment v-for={row in rows} key={row.id}><i v-for={cell in row.cells} key={cell}>{cell}</i></React.Fragment>', { rows: [{ id: 1, cells: ['x', 'y'] }] }), '<i>x</i><i>y</i>')
})

test('loop sources evaluate once; callback aliases shadow outer variables', () => {
  let calls = 0
  const items = () => {
    calls++
    return [1, 2]
  }
  assert.equal(html('<p v-for={item in items()} key={item}>{item}</p>', { items, item: 99 }), '<p>1</p><p>2</p>')
  assert.equal(calls, 1)
})

test('if guards the collection, while nested conditions can access loop aliases', () => {
  assert.equal(value('<p v-if={false} v-for={item in missing()} />'), null)
  assert.equal(html('<div v-for={item in items} key={item}><b v-if={item > 1}>{item}</b><i v-else>small</i></div>', { items: [1, 2] }), '<div><i>small</i></div><div><b>2</b></div>')
  assert.equal(html('<><p v-if={false} /><p v-else v-for={item in items} key={item}>{item}</p></>', { items: [1] }), '<p>1</p>')
})

for (const [source, error] of [
  ['<p v-show />', /requires a JSX expression/],
  ['<p v-show="false" />', /requires a JSX expression/],
  ['<p v-show={true} v-show={false} />', /Duplicate/],
  ['<React.Fragment v-show={true} />', /needs a DOM element/],
  ['<p v-for />', /requires a JSX expression/],
  ['<p v-for="item in items" />', /requires a JSX expression/],
  ['<p v-for={items} />', /v-for requires/],
  ['<p v-for={(a, b, c) in items} />', /v-for requires/],
  ['<p v-for={(a, a) in items} />', /v-for requires/],
  ['<p v-for={obj.item in items} />', /v-for requires/],
  ['<p v-for={item in items} v-for={item in items} />', /Duplicate/],
  ['async function f() { return <p v-for={item in items}>{await item}</p> }', /render synchronously/],
]) test(`diagnostic: ${source}`, () => assert.throws(() => compile(source), error))

test('show and loops emit no runtime imports and can be compiled twice', () => {
  const result = transformSync('<p v-for={item in items} v-show={item.visible} key={item.id} />', { configFile: false, babelrc: false, plugins: [directives] }).code
  assert.doesNotMatch(result, /require\(|import |v-show|v-for/)
  assert.equal(transformSync(result, { configFile: false, babelrc: false, plugins: [directives] }).code, result)
})

test('React DOM: visibility retains nodes/state, keyed rows retain input state through reordering', async () => {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="root"></div>')
  const saved = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT }
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
  const App = value('(function App({shown, items}) { return <main><div v-show={shown} style={{display: "flex"}}><Counter /></div><input v-for={item in items} key={item} v-show={shown} aria-label={item} /></main> })', { Counter }, 'automatic')
  const render = (shown, items) => React.act(() => root.render(React.createElement(App, { shown, items })))
  const warnings = []
  const oldError = console.error
  console.error = (...args) => warnings.push(args)
  try {
    await render(true, ['a', 'b'])
    const button = document.querySelector('button')
    const input = document.querySelector('input')
    await React.act(() => button.click())
    input.value = 'my note'
    await render(false, ['b', 'a'])
    assert.equal(document.querySelector('button'), button)
    assert.equal(button.parentElement.style.display, 'none')
    assert.equal(button.textContent, '1')
    assert.equal(cleanups, 0)
    assert.equal(document.querySelectorAll('input')[1], input)
    assert.equal(input.value, 'my note')
    await render(true, ['b', 'a'])
    assert.equal(button.parentElement.style.display, 'flex')
    assert.equal(input.style.display, '')
    await render(true, [])
    assert.equal(document.querySelectorAll('input').length, 0)
    assert.deepEqual(warnings, [])
  } finally {
    await React.act(() => root.unmount())
    console.error = oldError
    dom.window.close()
    global.window = saved.window
    global.document = saved.document
    global.IS_REACT_ACT_ENVIRONMENT = saved.act
  }
})
