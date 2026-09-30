export {};
import type { TestDocMeta, DocTestDetails } from '../types';
declare global {
    namespace Cypress {
        interface Chainable {
            docTest(detials: DocTestDetails): Chainable<undefined>;
            precondition(precondition: string): Chainable<undefined>;
            procedure(procedure: string): Chainable<undefined>;
            actualResult(actualResult: string): Chainable<undefined>;
        }
    }
}
export declare function getCurrentDocMeta(): TestDocMeta | null;
export declare function clearCurrentDocMeta(): void;
//# sourceMappingURL=commands.d.ts.map