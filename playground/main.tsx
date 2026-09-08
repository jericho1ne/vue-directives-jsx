import {
  Fragment,
  useState,
} from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>Local count: {count}</button>
}

function App() {
  const [status, setStatus] = useState('ready')
  const [visible, setVisible] = useState(true)
  const [details, setDetails] = useState(false)
  const [shown, setShown] = useState(true)
  const [items, setItems] = useState([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Cindy' }])
  const [nextId, setNextId] = useState(4)
  const [listVisible, setListVisible] = useState(true)
  return (
    <main>
      <header>
        <p className="eyebrow">JSX LAB / CHECKPOINT 02</p>
        <h1>Vue syntax.<br />React underneath.</h1>
        <p>Try conditional directives in a real React app. Edit <code>playground/main.jsx</code> to experiment.</p>
      </header>
      <section>
        <h2>01 · Pick a branch</h2>
        <div className="controls">
          <button aria-pressed={status === 'ready'} onClick={() => setStatus('ready')}>Ready</button>
          <button aria-pressed={status === 'loading'} onClick={() => setStatus('loading')}>Loading</button>
          <button aria-pressed={status === 'error'} onClick={() => setStatus('error')}>Error</button>
        </div>
        <div className="preview" aria-live="polite">
          <p v-if={status === 'ready'}>Ready to render. This is v-if.</p>
          {/* Comments may separate branches. */}
          <p v-else-if={status === 'loading'}>Loading your data. This is v-else-if.</p>
          <p v-else>Something went wrong. This is v-else.</p>
        </div>
        <pre>{`<p v-if={status === 'ready'}>Ready</p>
<p v-else-if={status === 'loading'}>Loading</p>
<p v-else>Error</p>`}
        </pre>
      </section>
      <section>
        <h2>02 · Unmount and reset</h2>
        <label><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Mount counter</label>
        <div className="preview">
          <Counter v-if={visible} />
          <p v-else>The counter is unmounted. Show it again to start at zero.</p>
        </div>
        <pre>{'<Counter v-if={visible} />'}</pre>
      </section>
      <section>
        <h2>03 · Nested fragment</h2>
        <label><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} /> Show details</label>
        <div className="preview">
          <Fragment v-if={details}>
            <h3>Two elements, no extra wrapper</h3>
            <p v-if={visible}>The counter above is mounted.</p>
            <p v-else>The counter above is unmounted.</p>
          </Fragment>
          <p v-else>Details are collapsed.</p>
        </div>
        <pre>{'<Fragment v-if={details}>…</Fragment>'}</pre>
      </section>
      <section>
        <h2>04 · Hide without resetting</h2>
        <label><input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} /> Show counter</label>
        <div className="preview" v-show={shown} style={{ display: 'flex', gap: 12 }}>
          <Counter />
          <span>My count survives hiding.</span>
        </div>
        <pre>{'<div v-show={shown} style={{ display: "flex" }}><Counter /></div>'}</pre>
      </section>
      <section>
        <h2>05 · Loop and reorder</h2>
        <div className="controls">
          <button
            onClick={() => {
              setItems([...items, { id: nextId, name: `Person ${nextId}` }])
              setNextId(nextId + 1)
            }}
          >
            Add person
          </button>
          <button onClick={() => setItems([...items].reverse())}>Reverse order</button>
          <button onClick={() => setItems([])}>Clear list</button>
        </div>
        <label><input type="checkbox" checked={listVisible} onChange={(e) => setListVisible(e.target.checked)} /> Show list rows</label>
        <ul className="people">
          <li v-for={(item, index) in items} v-show={listVisible} key={item.id}>
            <strong>{index + 1}. {item.name}</strong>
            <input aria-label={`Note for ${item.name}`} placeholder="Type a note, then reverse" />
            <button onClick={() => setItems(items.filter((person) => person.id !== item.id))}>Remove {item.name}</button>
          </li>
        </ul>
        <p v-if={items.length === 0}>No people yet. Add someone to start.</p>
        <pre>{'<li v-for={(item, index) in items} v-show={listVisible} key={item.id}>…</li>'}</pre>
      </section>
      <footer>Checkpoint 02: conditionals · visibility · array loops.</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
