"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCurrentDocMeta = exports.getCurrentDocMeta = void 0;
let currentDocMeta = null;
function getCurrentDocMeta() {
    return currentDocMeta;
}
exports.getCurrentDocMeta = getCurrentDocMeta;
function clearCurrentDocMeta() {
    currentDocMeta = null;
}
exports.clearCurrentDocMeta = clearCurrentDocMeta;
Cypress.Commands.add('docTest', (details) => {
    const testKey = `${Cypress.spec.relative}::${Cypress.currentTest.titlePath.join(' > ')}`;
    const expectedResult = details.expectedResult ?? Cypress.currentTest.title;
    const suite = details.suite ?? Cypress.currentTest.titlePath[0];
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
        };
    });
});
Cypress.Commands.add('procedure', (procedure) => {
    return cy.then(() => {
        if (!currentDocMeta) {
            throw new Error('cy.procedure() called before cy.docTest() — no active test doc to attach to');
        }
        currentDocMeta.procedure.push(procedure);
        Cypress.log({ name: 'added procedure', message: procedure });
    });
});
Cypress.Commands.add('actualResult', (actualResult) => {
    return cy.then(() => {
        if (!currentDocMeta) {
            throw new Error('cy.actualResult() called before cy.docTest() — no active test doc to attach to');
        }
        currentDocMeta.actualResultOverride = actualResult;
        throw new Error(actualResult);
    });
});
Cypress.Commands.add('precondition', (precondition) => {
    return cy.then(() => {
        if (!currentDocMeta) {
            throw new Error('cy.precondition() called before cy.docTest() — no active test doc to attach to');
        }
        currentDocMeta.preconditions.push(precondition);
        Cypress.log({ name: 'added precondition', message: precondition });
    });
});
//# sourceMappingURL=commands.js.map