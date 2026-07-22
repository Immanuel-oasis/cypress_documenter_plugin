// eslint-disable-next-line @typescript-eslint/no-empty-interface
export { }

import type { TestDocMeta } from '../types'

declare global {
  namespace Cypress {
    interface Chainable {
      docTest(meta: TestDocMeta): Chainable<void>
    }
  }
}

let currentDocMeta: TestDocMeta | null = null

export function getCurrentDocMeta(): TestDocMeta | null {
  return currentDocMeta
}

export function clearCurrentDocMeta(): void {
  currentDocMeta = null
}

Cypress.Commands.add('docTest', (meta: TestDocMeta) => {
  currentDocMeta = meta
  Cypress.log({
    name: 'docTest',
    message: `${meta.id} — ${meta.description}`,
    consoleProps: () => meta as any,
  })
})