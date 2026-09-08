# @jericho1ne/vue-directives-jsx

Vue-style structural directives for React JSX. It compiles to ordinary React JSX, adds no runtime dependency, and does not require Vue.

## Install

```sh
pnpm add -D @jericho1ne/vue-directives-jsx @babel/core
npm install -D @jericho1ne/vue-directives-jsx @babel/core
yarn add -D @jericho1ne/vue-directives-jsx @babel/core
bun add -d @jericho1ne/vue-directives-jsx @babel/core
```

## Use with Vite + React

Register the directive plugin before React:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import vueDirectives from '@jericho1ne/vue-directives-jsx/vite'

export default defineConfig({
  plugins: [vueDirectives(), react()],
})
```

For another Babel-based build:

```json
{ "plugins": ["module:@jericho1ne/vue-directives-jsx"] }
```

## Directives

```tsx
// v-show: hide without unmounting
<div v-show={visible}><Counter /></div>

// v-if, v-else, and v-else-if: sibling branches
<>
  <p v-if={status === 'loading'}>Loading…</p>
  <p v-else-if={status === 'error'}>Something went wrong.</p>
  <p v-else>Ready.</p>
</>

// v-for: arrays, with an optional index
<ul>
  <li v-for={(item, index) in items} key={item.id}>
    {index + 1}. {item.name}
  </li>
</ul>
```

## TypeScript

Add the JSX declarations once, then use the typecheck wrapper so aliases introduced by `v-for` are checked correctly:

```ts
import type {} from '@jericho1ne/vue-directives-jsx/jsx'
```

```json
{ "scripts": { "typecheck": "vue-directives-jsx --project tsconfig.json" } }
```

## Limits

- Directives use JSX expressions: `v-if={visible}`, never quoted Vue expressions.
- `v-else-if` and `v-else` must immediately follow a `v-if` branch, apart from whitespace or JSX comments.
- `v-show` needs a DOM element or a component that forwards `style`.
- `v-for` accepts arrays and one or two identifier aliases. Use stable React keys.
- On one element, `v-if` runs before `v-for`; conditions that use the item belong inside the loop.

For development, run `pnpm check`. See [usage notes](./docs/usage.md) for directive behavior.

MIT.
