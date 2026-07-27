// export interface TestDocMeta {
//   suite: string
//   id: string
//   description: string
//   preconditions: string[]
//   procedure: string[]
//   testData: string
//   expectedResult: string
//   assigned?: string | undefined
//   comment?: string | undefined
//   actualResultOverride?: string
// }

/** What you pass to cy.docTest() — steps get added afterward via cy.precondition()/cy.procedure() */
export interface DocTestDetails {
  /** e.g. "Home Page" — groups rows the same way your example sheet does */
  suite: string
  /** e.g. "TC-HOME-001" */
  id?: string
  description?: string
  testData: string
  expectedResult: string
  /** Optional — leave blank to fall back to the sheet's "Assigned" column being empty */
  assigned?: string
  /** Optional — e.g. "Tested on the following Browsers: Brave, Chrome, and Microsoft Edge" */
  comment?: string
  /**
   * Optional override. If omitted, the afterEach hook fills this in automatically:
   * - on pass: same text as expectedResult
   * - on fail: the Cypress/Mocha error message
   */
  actualResultOverride?: string
}

export interface TestDocEntry extends Omit<TestDocMeta, 'actualResultOverride'> {
  actualResult: string
  status: 'Passed' | 'Failed'
}


/** The full in-memory record for the currently-running test, built up via cy.precondition()/cy.procedure() */
export interface TestDocMeta extends DocTestDetails {
  preconditions: string[]
  procedure: string[]
  /**
   * Auto-computed from the spec file path + full test title path — NOT
   * something you set yourself. This is what actually determines whether
   * two recorded entries are "the same test case" for merge/replace
   * purposes. `id` stays purely a human-readable label for the spreadsheet
   * and can safely collide (e.g. copy-paste typos across two different
   * tests) without causing data loss, since testKey is what's actually
   * unique and stable across runs regardless of which spec ran first.
   */
  testKey: string
}