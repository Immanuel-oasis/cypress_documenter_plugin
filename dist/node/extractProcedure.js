"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFullProcedureList = void 0;
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
function extractFullProcedureList(specAbsolutePath, titlePath) {
    let sourceText;
    try {
        sourceText = fs.readFileSync(specAbsolutePath, 'utf-8');
    }
    catch {
        return null;
    }
    const sourceFile = ts.createSourceFile(specAbsolutePath, sourceText, ts.ScriptTarget.Latest, true);
    let found = null;
    function isDescribeOrIt(expr, names) {
        // Matches: describe(...) / describe.only(...) / it(...) / it.only(...) / it.skip(...)
        if (ts.isIdentifier(expr) && names.includes(expr.text))
            return expr.text;
        if (ts.isPropertyAccessExpression(expr) &&
            ts.isIdentifier(expr.expression) &&
            names.includes(expr.expression.text)) {
            return expr.expression.text;
        }
        return null;
    }
    function getStringArg(node, index) {
        const arg = node.arguments[index];
        if (arg && ts.isStringLiteralLike(arg))
            return arg.text;
        return null;
    }
    function walk(node, describeStack) {
        if (found)
            return; // already located the test — no need to keep walking
        if (ts.isCallExpression(node)) {
            const kind = isDescribeOrIt(node.expression, ['describe', 'context']);
            if (kind) {
                const title = getStringArg(node, 0);
                const fn = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
                if (title !== null && fn) {
                    ts.forEachChild(fn, (child) => walk(child, [...describeStack, title]));
                }
                return; // don't also fall through to generic recursion below
            }
            const itKind = isDescribeOrIt(node.expression, ['it']);
            if (itKind) {
                const title = getStringArg(node, 0);
                const fn = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
                if (title !== null && fn) {
                    const fullPath = [...describeStack, title];
                    if (arraysEqual(fullPath, titlePath)) {
                        found = collectProcedureCalls(fn);
                        return;
                    }
                }
                return;
            }
        }
        ts.forEachChild(node, (child) => walk(child, describeStack));
    }
    function collectProcedureCalls(testBodyFn) {
        const steps = [];
        function inner(node) {
            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === 'cy' &&
                node.expression.name.text === 'procedure') {
                const arg = node.arguments[0];
                if (arg && ts.isStringLiteralLike(arg)) {
                    steps.push(arg.text);
                }
                else {
                    // Dynamic value (template literal, variable, etc.) — can't
                    // statically resolve it. Mark it so the gap is at least visible
                    // rather than silently dropped.
                    steps.push('(dynamic step — could not be statically determined)');
                }
            }
            ts.forEachChild(node, inner);
        }
        inner(testBodyFn);
        return steps;
    }
    function arraysEqual(a, b) {
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    walk(sourceFile, []);
    return found;
}
exports.extractFullProcedureList = extractFullProcedureList;
//# sourceMappingURL=extractProcedure.js.map