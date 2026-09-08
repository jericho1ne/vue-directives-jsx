import type {} from 'react'

declare module 'react' {
  interface Attributes {
    'v-if'?: unknown
    'v-else-if'?: unknown
    'v-else'?: true
    'v-show'?: unknown
    'v-for'?: unknown
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- React's declaration requires T.
  interface HTMLAttributes<T> {
    'v-if'?: unknown
    'v-else-if'?: unknown
    'v-else'?: true
    'v-show'?: unknown
    'v-for'?: unknown
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- React's declaration requires T.
  interface SVGAttributes<T> {
    'v-if'?: unknown
    'v-else-if'?: unknown
    'v-else'?: true
    'v-show'?: unknown
    'v-for'?: unknown
  }
}

export {}
