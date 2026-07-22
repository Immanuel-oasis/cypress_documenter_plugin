import { getCurrentDocMeta, clearCurrentDocMeta } from './commands'
import type { TestDocEntry } from '../types'

export function setupDocAfterEachHook() {
  afterEach(function () {
    const meta = getCurrentDocMeta()
    if (!meta) return

    const state = this.currentTest?.state
    const errorMessage = this.currentTest?.err?.message
    const status: TestDocEntry['status'] = state === 'passed' ? 'Passed' : 'Failed'

    const actualResult =
      meta.actualResultOverride ??
      (status === 'Passed'
        ? meta.expectedResult
        : errorMessage || 'Test failed — see Cypress run log for details')

    const entry: TestDocEntry = {
      suite: meta.suite,
      id: meta.id,
      description: meta.description,
      preconditions: meta.preconditions,
      procedure: meta.procedure,
      testData: meta.testData,
      expectedResult: meta.expectedResult,
      assigned: meta.assigned,
      comment: meta.comment,
      actualResult,
      status,
    }

    cy.task('recordTestDoc', entry, { log: false })
    clearCurrentDocMeta()
  })
}