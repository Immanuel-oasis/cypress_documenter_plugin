// eslint-disable-next-line @typescript-eslint/no-empty-interface
export { }

import type { TestDocMeta } from '../types'

declare global {
  namespace Cypress {
    interface Chainable {
      docTest(detials: {
        suite: string
        id: string
        description: string
        testData: string
        expectedResult: string
        assigned?: string | undefined
        comment?: string | undefined
        actualResultOverride?: string
      }): Chainable<void>,
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

Cypress.Commands.add('docTest', (details: {
  suite: string
  id: string
  description: string
  testData: string
  expectedResult: string
  assigned?: string | undefined
  comment?: string | undefined
  actualResultOverride?: string
}) => {

  return cy.then(() => {
    currentDocMeta = {
      ...details,
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
      throw new Error('cy.step() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.procedure.push(procedure)
    Cypress.log({ name: 'procedure', message: procedure })
  })

})


Cypress.Commands.add('precondition', (precondition: string) => {
  return cy.then(() => {
    if (!currentDocMeta) {
      throw new Error('cy.step() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.preconditions.push(precondition)
    Cypress.log({ name: 'step', message: precondition })
  })

})