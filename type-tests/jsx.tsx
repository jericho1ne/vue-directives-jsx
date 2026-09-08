import type {} from '@jericho1ne/vue-directives-jsx/jsx'

declare const visible: boolean
declare const items: readonly { id: string }[]

const Component = (_props: object) => null

export const directivesAreAccepted = (
  <>
    <div v-if={visible} v-show={visible} />
    <Component v-if={visible} />
    <div v-for={items} />
  </>
)
