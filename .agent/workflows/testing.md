---
description: run tests and verify code quality
---

# Testing Workflow

## Run All Tests

// turbo
1. Execute full test suite: `npm run test`
2. Wait for results
3. Verify all tests pass

## Run Specific Test File

```bash
npm run test subscription-lifecycle
npm run test invoice-lifecycle
npm run test security-validation
```

## Watch Mode (Development)

// turbo
1. Start watch mode: `npm run test:watch`
2. Tests re-run automatically on changes
3. Press `q` to quit

## Type Checking

// turbo
1. Run TypeScript compiler: `npm run check`
2. Fix any type errors
3. Re-run until zero errors

## Pre-Commit Checklist

Before committing code, verify:

- [ ] `npm run check` passes (zero TypeScript errors)
- [ ] `npm run test` passes (all tests green)
- [ ] No `console.log` statements in production code
- [ ] No TODO comments without GitHub issue links
- [ ] Code follows existing patterns

## Test Coverage

Current test coverage:
- **Invoice Lifecycle**: 79+ tests
- **Subscription Lifecycle**: 37+ tests
- **Security & Validation**: Comprehensive
- **Crypto**: Encryption/decryption
- **E2E**: Complete flow tests

## Writing New Tests

Follow existing test patterns:

```typescript
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should do something specific", () => {
    // Arrange
    const input = "test";
    
    // Act
    const result = processInput(input);
    
    // Assert
    expect(result).toBe("expected");
  });
});
```

## Debugging Failing Tests

1. Run specific test: `npm run test path/to/test.test.ts`
2. Add `console.log` for debugging
3. Check test output for error message
4. Fix issue
5. Re-run test
6. Remove debug logs

## CI/CD Integration

Tests run automatically on:
- Every push to GitHub
- Pull request creation
- Before deployment

**Important**: All tests must pass before merging to main!
