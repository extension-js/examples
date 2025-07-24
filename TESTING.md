# E2E Testing Documentation

This document describes the E2E testing setup for the Extension.js examples repository.

## Overview

The examples repository includes comprehensive E2E testing that ensures all 30+ template examples work correctly in browser environments across different platforms.

## Test Architecture

### E2E Tests (Playwright)

- **Purpose**: Test all template examples in browser environment
- **Files**: All `template.spec.ts` files (30+ templates)
- **Framework**: Playwright with Chromium browser
- **Features**: Screenshot capture, video recording, trace collection

### Cross-Platform Tests

- **Purpose**: Ensure compatibility across different operating systems
- **Platforms**: Ubuntu, Windows, macOS
- **Node.js Version**: 18

## Test Configuration

### Playwright Configuration (`playwright.config.ts`)

```typescript
export default defineConfig({
  timeout: process.env.CI ? 90_000 : 60_000,
  testDir: './',
  testMatch: '**/template.spec.ts',
  fullyParallel: false,
  retries: process.env.CI ? 3 : 2,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', {outputFolder: 'e2e-report'}],
    ['list'],
    ['json', {outputFile: 'test-results.json'}],
    ['junit', {outputFile: 'test-results.xml'}]
  ],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts'
})
```

## Test Scripts

### Available Commands

```bash
# E2E Tests
npm run test                    # Run all template tests
npm run test:watch             # Run tests with UI (interactive)
npm run test:debug             # Run tests in debug mode
npm run test:headed            # Run tests in headed mode
npm run test:report            # Show test reports
npm run test:install           # Install Playwright browsers
```

## Template Test Structure

Each template includes a `template.spec.ts` file that tests:

1. **Extension Loading**: Verifies the extension loads in the browser
2. **Content Rendering**: Checks that content is properly displayed
3. **Styling**: Validates CSS is applied correctly
4. **Image Loading**: Ensures all images load successfully
5. **Functionality**: Tests interactive elements work as expected

### Example Template Test

```typescript
import {extensionFixtures, getShadowRootElement} from '../extension-fixtures'

const test = extensionFixtures(pathToExtension, true)

test('should exist an element with the class name extension-root', async ({
  page
}) => {
  await page.goto('https://extension.js.org/')
  const shadowRootHandle = await page
    .locator('#extension-root')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)

  test.expect(shadowRootHandle).not.toBeNull()
})

test('should load all images successfully', async ({page}) => {
  await page.goto('https://extension.js.org/')
  // Test image loading logic
})
```

## CI/CD Workflows

### GitHub Actions Workflows

1. **🛠 CI** (`ci.yml`)
   - E2E testing for all template examples
   - Cross-platform testing (Ubuntu, Windows, macOS)
   - Node.js version (18)
   - Test reporting and artifacts

### Workflow Features

- **Parallel Execution**: Tests run in parallel where possible
- **Retry Logic**: Failed tests are retried automatically
- **Artifact Collection**: Test results and reports are preserved
- **Cross-Platform**: Tests run on multiple operating systems
- **Node.js Version**: Tests on Node.js 18

## Test Results and Reporting

### E2E Test Reports

- **HTML Reports**: Interactive test reports
- **Screenshots**: Failure screenshots
- **Videos**: Test execution videos
- **Traces**: Detailed execution traces
- **JUnit**: CI integration format

### Artifacts

- **Test Results**: JSON and XML formats
- **Screenshots**: Failure screenshots
- **Videos**: Test execution recordings
- **Traces**: Detailed execution traces

## Troubleshooting

### Common Issues

1. **Playwright Browser Installation**

   ```bash
   npm run test:install
   ```

2. **Test Timeouts**

   - Increase timeout in Playwright config
   - Check for slow network operations

3. **Image Loading Failures**

   - Ensure images are in `public/` directory
   - Check image file integrity
   - Verify import paths

4. **Extension Loading Issues**
   - Check build output location
   - Verify manifest.json configuration
   - Ensure proper file paths

### Debug Mode

```bash
# Debug E2E tests
npm run test:debug

# Run with UI
npm run test:watch

# Run in headed mode
npm run test:headed
```

## Performance Considerations

### CI Optimization

- **Parallel Workers**: Limited to 1 in CI to prevent resource contention
- **Retry Logic**: 3 retries in CI vs 2 locally
- **Timeout**: Increased timeouts for CI environment
- **Artifact Retention**: 30 days for comprehensive results, 7 days for quick checks

### Local Development

- **Watch Mode**: Available for interactive testing
- **UI Mode**: Interactive Playwright UI
- **Debug Mode**: Step-through debugging
- **Headed Mode**: Visible browser execution

## Template Coverage

### Current Templates (30+)

- **Basic Templates**: `new`, `content`, `action`, `sidebar`, `storage`, `init`
- **Content Script Variants**: `content-react`, `content-vue`, `content-svelte`, `content-preact`, `content-typescript`, etc.
- **New Tab Variants**: `new-react`, `new-vue`, `new-svelte`, `new-preact`, `new-typescript`, etc.
- **Configuration Templates**: `new-config-babel`, `new-config-eslint`, `new-config-lint`, etc.
- **Special Features**: `new-crypto`, `new-node-apis`, `action-chatgpt`, `sidebar-shadcn`, etc.

### Test Categories

Each template test validates:

- ✅ Extension loading and injection
- ✅ Content rendering and display
- ✅ CSS styling and layout
- ✅ Image loading and display
- ✅ Interactive functionality
- ✅ Cross-browser compatibility
