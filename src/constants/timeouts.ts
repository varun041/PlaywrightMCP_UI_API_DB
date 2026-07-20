export const Timeouts = {
  DEFAULT_ACTION_TIMEOUT_MS: Number(process.env.DEFAULT_ACTION_TIMEOUT_MS ?? 10_000),
  DEFAULT_NAVIGATION_TIMEOUT_MS: Number(process.env.DEFAULT_NAVIGATION_TIMEOUT_MS ?? 15_000),
  /** BR-10 (Requirement.md) — JWTs are signed with a fixed 24h expiry; `TokenUtils` uses this instead of a literal. */
  TOKEN_EXPIRY_HOURS: 24,
  /** PERF-* scenarios (TestScenarios.md §16) — provisional, not a confirmed NFR (Requirement.md open question). */
  PERFORMANCE_THRESHOLD_MS: Number(process.env.PERFORMANCE_THRESHOLD_MS ?? 500),
  /** "Light concurrent load" for PerformanceSmoke/Concurrency scenarios — a small fixed fan-out, not a load-test tool. */
  LIGHT_LOAD_CONCURRENCY: 10,
  HEALTH_CHECK_POLL_INTERVAL_MS: 500,
  HEALTH_CHECK_TIMEOUT_MS: 30_000,
} as const;
