import './commands'
import { getCurrentDocMeta, clearCurrentDocMeta } from './commands'
import type { TestDocEntry } from '../types'

export function setupDocAfterEachHook() {

  afterEach(function () {
    // Documentation only happens during `cypress run` — never during
    // `cypress open`. This is what avoids duplicate/accumulating entries
    // from refreshing or re-running specs interactively.
    if (Cypress.config('isInteractive')) return

    const meta = getCurrentDocMeta()

    // If a test didn't call docTest(), skip it silently —
    // lets you adopt this incrementally, test by test.
    if (!meta) return

    const state = this.currentTest?.state // 'passed' | 'failed' | 'pending'
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
      testKey: meta.testKey,
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

    // cy.task hands this off to the Node process, since only Node can write files.
    // { log: false } keeps the command log uncluttered.
    cy.task('recordTestDoc', entry, { log: false })

    clearCurrentDocMeta()
  })
}