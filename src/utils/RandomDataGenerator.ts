import crypto from 'crypto';

/**
 * Produces run-unique variants of YAML template data (timestamp + random suffix) so tests never
 * collide on unique constraints (`users.username`, `customers.email`) across parallel workers or
 * repeated runs — the "self-contained, no cross-run collisions" strategy from AutomationTestPlan.md.
 */
export class RandomDataGenerator {
  private static runId = `${Date.now()}${process.pid}`;

  static uniqueSuffix(): string {
    return `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  }

  static uniqueUsername(base: string): string {
    return `${base}_${RandomDataGenerator.uniqueSuffix()}`;
  }

  static uniqueEmail(base: string): string {
    const [localPart, domain] = base.split('@');
    return `${localPart}+${RandomDataGenerator.uniqueSuffix()}@${domain ?? 'bankcorp.com'}`;
  }

  /** Stable identifier for everything created by this worker/run, for optional teardown-by-prefix. */
  static runScopedId(prefix: string): string {
    return `${prefix}-${RandomDataGenerator.runId}-${crypto.randomBytes(2).toString('hex')}`;
  }
}
