# Cypress Test Documenter
This plugin helps you generate and document your cypress commands in all one code base!!!, to get started download it and read the How to install section below.

### How to Install

1. open the plugin folder in any terminal of your choice or vs code and run  `npm install` this makes sure it gets the required node modules (all it use is excel js)

2. ```npm i ../<path you downloaded the file to>```  (we always recommend putting it in the same folder as your **Test folder** so it can be easy to point to when running the `npm i` command)

3. Once you've successfully installed the plugin in your project follow just add the required (3) lines of code to the specified files as stated below

#### In cypress.config file add 
```
import { defineConfig } from "cypress";
import { registerTestDocumentation } from 'cypress_test_documenter/src/node' // copy and paste

export default defineConfig({
  allowCypressEnv: false,

  e2e: {
    setupNodeEvents(on, config) {
     registerTestDocumentation(on) // add this
     return config // add this
    },
  },
});
```

#### support/e2e.ts
`import 'cypress_test_documenter/src/browser' // add this line`

## How to use



## Frequently Asked Questions (FAQ)
**Q1**- I followed all the steps but my cypress shows some errors <br>
**Ans**: make sure you are using typescript version 5.*, as cypress doesnt currently support higher versions like 7

**Q2**- I am using typescript 5 and have everything else running but still get some tsconfig error <br>
**Ans**: This is not a plugin issue you basically forgot to add tsconfig to you project. Do this by running `npx tsc --init`
