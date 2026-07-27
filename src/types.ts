export interface TestDocMeta {
  suite: string
  id: string
  description: string
  preconditions: string[]
  procedure: string[]
  testData: string
  expectedResult: string
  assigned?: string | undefined
  comment?: string | undefined
  actualResultOverride?: string
}

export interface TestDocEntry extends Omit<TestDocMeta, 'actualResultOverride'> {
  actualResult: string
  status: 'Passed' | 'Failed'
}