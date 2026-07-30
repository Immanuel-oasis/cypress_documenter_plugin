// eslint-disable-next-line @typescript-eslint/no-empty-interface
export { }

import type { TestDocMeta, DocTestDetails } from '../types'

declare global {
  namespace Cypress {
    interface Chainable {
      docTest(detials: DocTestDetails): Chainable<undefined>,
      precondition(precondition: string): Chainable<undefined>,
      procedure(procedure: string): Chainable<undefined>
      actualResult(actualResult: string): Chainable<undefined>
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
  const expectedResult = details.expectedResult ?? Cypress.currentTest.title
  const suite = details.suite ?? Cypress.currentTest.titlePath[0]

  return cy.then(() => {
    currentDocMeta = {
      ...details,
      expectedResult,
      suite,
      testKey,
      preconditions: [],
      procedure: [],
      // NEW: needed on the Node side to re-open this exact spec file and
      // recover the full intended procedure list, including any steps
      // never reached because an earlier one failed.
      specRelativePath: Cypress.spec.relative,
      titlePath: Cypress.currentTest.titlePath,
    }
  })
})

Cypress.Commands.add('procedure', (procedure: string) => {
  return cy.then(() => {
    if (!currentDocMeta) {
      throw new Error('cy.procedure() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.procedure.push(procedure)
    Cypress.log({ name: 'added procedure', message: procedure })
  })
})

Cypress.Commands.add('actualResult', (actualResult: string) => {
  return cy.then(() => {
    if (!currentDocMeta) {
      throw new Error('cy.actualResult() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.actualResultOverride = actualResult
    Cypress.log({ name: 'added actual result', message: actualResult })
  })
})

Cypress.Commands.add('precondition', (precondition: string) => {
  return cy.then(() => {
    if (!currentDocMeta) {
      throw new Error('cy.precondition() called before cy.docTest() — no active test doc to attach to')
    }
    currentDocMeta.preconditions.push(precondition)
    Cypress.log({ name: 'added precondition', message: precondition })
  })
})