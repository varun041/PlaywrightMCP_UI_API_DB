import { ApiResult } from '@services/ApiClient';

export interface ExpectedApiError {
  status: number;
  message?: string;
}

/**
 * Backs every API-layer negative/validation scenario — reads in business terms instead of separate
 * status/body checks. `received` accepts `undefined` since the common call shape is
 * `expect(state.lastApiResponse).toMatchApiError(...)` and `lastApiResponse` is optional.
 */
export const apiMatchers = {
  toMatchApiError(received: ApiResult<{ error?: string }> | undefined, expected: ExpectedApiError) {
    if (!received) {
      return { pass: false, message: () => 'expected an API response but got undefined' };
    }
    const statusMatches = received.status === expected.status;
    const messageMatches = expected.message === undefined || received.body?.error === expected.message;
    const pass = statusMatches && messageMatches;
    return {
      pass,
      message: () =>
        `expected API error status ${expected.status}${expected.message ? ` with message "${expected.message}"` : ''}, ` +
        `but got status ${received.status} with body ${JSON.stringify(received.body)}`,
    };
  },

  /** Backs `@PerformanceSmoke` scenarios — provisional thresholds (Requirement.md open question), not certified NFRs. */
  toRespondWithinThreshold(received: number, thresholdMs: number) {
    const pass = received <= thresholdMs;
    return {
      pass,
      message: () => `expected response time ${received}ms to be within the ${thresholdMs}ms performance threshold`,
    };
  },
};
