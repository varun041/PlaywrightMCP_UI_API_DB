import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('AccessibilityScanner');

export interface AccessibilityViolation {
  id: string;
  impact: string | null | undefined;
  description: string;
  nodes: number;
}

export interface AccessibilityScanResult {
  violations: AccessibilityViolation[];
  criticalOrSerious: AccessibilityViolation[];
}

/** Wraps an axe-core scan against a given Page (optionally scoped to a locator root), backing every `@Accessibility` scenario. */
export class AccessibilityScanner {
  static async scan(page: Page, scopeSelector?: string): Promise<AccessibilityScanResult> {
    let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
    if (scopeSelector) {
      builder = builder.include(scopeSelector);
    }
    const results = await builder.analyze();
    const violations: AccessibilityViolation[] = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.length,
    }));
    const criticalOrSerious = violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    logger.info('Accessibility scan complete', {
      total: violations.length,
      criticalOrSerious: criticalOrSerious.length,
    });
    return { violations, criticalOrSerious };
  }

  /** Scoped scan focused on color-contrast only (used by the "meets WCAG AA contrast" scenario). */
  static async scanColorContrast(page: Page): Promise<AccessibilityScanResult> {
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    const violations: AccessibilityViolation[] = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.length,
    }));
    return { violations, criticalOrSerious: violations };
  }
}
