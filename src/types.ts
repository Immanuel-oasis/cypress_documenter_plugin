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
  status: 'Passed' | 'Failed'
  /** NEW: steps that were part of the test's source but never reached
   *  because an earlier step failed. Empty on a passing test. */
  skippedProcedure: string[]
}