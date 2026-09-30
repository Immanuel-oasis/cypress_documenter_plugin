"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDocAfterEachHook = void 0;
require("./commands");
const commands_1 = require("./commands");
function setupDocAfterEachHook() {
    afterEach(function () {
        // Documentation only happens during `cypress run` — never during
        // `cypress open`. This is what avoids duplicate/accumulating entries
        // from refreshing or re-running specs interactively.
        // if (Cypress.config('isInteractive')) return
        const meta = (0, commands_1.getCurrentDocMeta)();
        // If a test didn't call docTest(), skip it silently —
        // lets you adopt this incrementally, test by test.
        if (!meta)
            return;
        const state = this.currentTest?.state; // 'passed' | 'failed' | 'Skipped'
        const errorMessage = this.currentTest?.err?.message;
        const status = state === 'passed' ? 'Passed' : state === 'failed' ? 'Failed' : 'Blocked';
        const actualResult = meta.actualResultOverride ?? (status === 'Passed' ? meta.expectedResult : errorMessage ?? 'No error message available');
        const comment = meta.comment;
        const entry = {
            suite: meta.suite,
            id: meta.id,
            testKey: meta.testKey,
            description: meta.description,
            preconditions: meta.preconditions,
            procedure: meta.procedure,
            testData: meta.testData,
            expectedResult: meta.expectedResult,
            assigned: meta.assigned,
            comment: comment,
            actualResult: actualResult,
            status: status,
            skippedProcedure: [],
            specRelativePath: meta.specRelativePath,
            titlePath: meta.titlePath
        };
        // cy.task hands this off to the Node process, since only Node can write files.
        // { log: false } keeps the command log uncluttered.
        cy.task('recordTestDoc', entry, { log: false });
        (0, commands_1.clearCurrentDocMeta)();
    });
}
exports.setupDocAfterEachHook = setupDocAfterEachHook;
//# sourceMappingURL=hooks.js.map