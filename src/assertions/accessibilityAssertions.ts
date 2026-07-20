import { Page } from '@playwright/test';
import { AccessibilityScanner } from '@utils/AccessibilityScanner';

/** Wraps `AccessibilityScanner` violations into a single matcher for every `@Accessibility` scenario. */
export const accessibilityMatchers = {
  async toBeAccessible(received: Page, scopeSelector?: string) {
    const result = await AccessibilityScanner.scan(received, scopeSelector);
    const pass = result.criticalOrSerious.length === 0;
    return {
      pass,
      message: () =>
        pass
          ? 'expected critical/serious accessibility violations but found none'
          : `found ${result.criticalOrSerious.length} critical/serious accessibility violation(s):\n${JSON.stringify(result.criticalOrSerious, null, 2)}`,
    };
  },
};
