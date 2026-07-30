import * as fs from 'fs'
import * as ts from 'typescript'


export function extractFullProcedureList(
  specAbsolutePath: string,
  titlePath: string[]
): string[] | null {
  let sourceText: string
  try {
    sourceText = fs.readFileSync(specAbsolutePath, 'utf-8')
  } catch {
    return null
  }

  const sourceFile = ts.createSourceFile(
    specAbsolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  )

  let found: string[] | null = null

  function isDescribeOrIt(expr: ts.Expression, names: string[]): string | null {
    // Matches: describe(...) / describe.only(...) / it(...) / it.only(...) / it.skip(...)
    if (ts.isIdentifier(expr) && names.includes(expr.text)) return expr.text
    if (
      ts.isPropertyAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      names.includes(expr.expression.text)
    ) {
      return expr.expression.text
    }
    return null
  }

  function getStringArg(node: ts.CallExpression, index: number): string | null {
    const arg = node.arguments[index]
    if (arg && ts.isStringLiteralLike(arg)) return arg.text
    return null
  }

  function walk(node: ts.Node, describeStack: string[]) {
    if (found) return // already located the test — no need to keep walking

    if (ts.isCallExpression(node)) {
      const kind = isDescribeOrIt(node.expression, ['describe', 'context'])
      if (kind) {
        const title = getStringArg(node, 0)
        const fn = node.arguments.find(
          (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)
        )
        if (title !== null && fn) {
          ts.forEachChild(fn, (child) => walk(child, [...describeStack, title]))
        }
        return // don't also fall through to generic recursion below
      }

      const itKind = isDescribeOrIt(node.expression, ['it'])
      if (itKind) {
        const title = getStringArg(node, 0)
        const fn = node.arguments.find(
          (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)
        )
        if (title !== null && fn) {
          const fullPath = [...describeStack, title]
          if (arraysEqual(fullPath, titlePath)) {
            found = collectProcedureCalls(fn)
            return
          }
        }
        return
      }
    }

    ts.forEachChild(node, (child) => walk(child, describeStack))
  }

  function collectProcedureCalls(testBodyFn: ts.Node): string[] {
    const steps: string[] = []

    function inner(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'cy' &&
        node.expression.name.text === 'procedure'
      ) {
        const arg = node.arguments[0]
        if (arg && ts.isStringLiteralLike(arg)) {
          steps.push(arg.text)
        } else {
          // Dynamic value (template literal, variable, etc.) — can't
          // statically resolve it. Mark it so the gap is at least visible
          // rather than silently dropped.
          steps.push('(dynamic step — could not be statically determined)')
        }
      }
      ts.forEachChild(node, inner)
    }

    inner(testBodyFn)
    return steps
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i])
  }

  walk(sourceFile, [])
  return found
}