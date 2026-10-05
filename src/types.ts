export interface DocTestDetails {
  suite?: string
  id?: string
  description: string
  testData: string
  expectedResult?: string
  assigned?: string
  comment?: string
  actualResultOverride?: string
}

export interface TestDocMeta extends DocTestDetails {
  expectedResult: string, //added this
  preconditions: string[]
  procedure: string[]
  testKey: string
  /** NEW: needed on the Node side to re-open the spec file and recover the
   *  full intended procedure list, including steps never reached. */
  specRelativePath: string
  /** NEW: needed to locate the exact it() block inside that spec file. */
  titlePath: string[]
}

export interface TestDocEntry extends Omit<TestDocMeta, 'actualResultOverride'> {
  actualResult: string
  status: 'Passed' | 'Failed' | 'Blocked'
  /** NEW: steps that were part of the test's source but never reached
   *  because an earlier step failed. Empty on a passing test. */
  skippedProcedure: string[]
}

export interface TestDocOptions {
  /**
   * When true, on a failed test the last runtime procedure is moved from
   * the "completed" list to the "skipped" list, so it renders in red
   * italic in the spreadsheet.
   *
   * Enable this if you use cy.procedure() as a "what I'm about to do"
   * comment — the last pushed procedure is then the one whose action was
   * in-flight when the failure occurred.
   *
   * DANGER: mislabels the last procedure as "skipped" when the failure
   * happened *after* that procedure's action completed (e.g., a later
   * assertion failed). Only enable if you accept this trade-off.
   */
  markLastProcedureAsSkipped?: boolean
}