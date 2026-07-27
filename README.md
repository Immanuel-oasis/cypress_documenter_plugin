# How to setup

npm i ../(path you downloaded to)

### cypress.config file add 
```
import { defineConfig } from "cypress";
import { registerTestDocumentation } from 'cypress_test_documenter/src/node // add this

export default defineConfig({
  allowCypressEnv: false,

  e2e: {
    baseUrl: '',
    setupNodeEvents(on, config) {
     registerTestDocumentation(on) // add this
     return config // add this
    },
  },
});
```

### support/e2e.ts
`import 'cypress_test_documenter/src/browser' // add this line`
