# Usage notes

The package compiles directives before JSX lowering. React still owns rendering, reconciliation, keys, and component state.

- `v-if` renders the first truthy sibling branch; a branch that is not selected does not evaluate its props or children.
- `v-show` sets `display: none` while retaining the mounted component and its state.
- `v-for={item in items}` and `v-for={(item, index) in items}` compile to `items.map(...)`. Collections must be arrays and render synchronously.
- Add stable `key` props to loop elements. Nested loops and imported `Fragment` components work.
- `v-if` takes priority over `v-for` on the same element, so its expression cannot reference that loop's aliases.

Use `pnpm dev` to try the playground, and `pnpm check` before contributing. Installation and setup are in the [README](../README.md).
