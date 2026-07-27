// eslint-disable-next-line @typescript-eslint/no-empty-interface
export { }

import type { TestDocMeta, DocTestDetails } from '../types'

declare global {
  namespace Cypress {
    interface Chainable {
      docTest(detials: DocTestDetails): Chainable<void>,
      /**
       * This commands adds a new preconditon to the docTest
      * @param precondition type string
      */
      precondition(precondition: string): Chainable<void>,
      /**
      * Adds a new procedure to the docTest
      * @param procedure type string
      */
      procedure(procedure: string): Chainable<void>
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

Cypress.Commands.add('docTest', (details: DocTestDetails) => {
  const testKey = `${Cypress.spec.relative}::${Cypress.currentTest.titlePath.join(' > ')}`
  const description = details.description ?? Cypress.currentTest.title
  return cy.then(() => {
    currentDocMeta = {
      ...details,
      description,
      testKey,
      preconditions: [],
      procedure: []
    }
  })

})
/**
 * This commands adds a new procedure to the docTest
 */
Cypress.Commands.add('procedure', (procedure: string) => {
  return cy.then(() => {
    if (!currentDocMeta) {
      throw new Error('cy.procedure() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.procedure.push(procedure)
    Cypress.log({ name: 'procedure', message: procedure })
  })

})


Cypress.Commands.add('precondition', (precondition: string) => {
  return cy.then(() => {
    if (!currentDocMeta) {
      throw new Error('cy.precodition() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.preconditions.push(precondition)
    Cypress.log({ name: 'step', message: precondition })
  })

})