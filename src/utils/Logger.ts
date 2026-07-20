type LogLevel = 'info' | 'warn' | 'error' | 'step';

/**
 * Thin structured console logger used for in-test narrative logging (setup/teardown, API calls,
 * step boundaries). Playwright's own reporters (html/junit/list, configured in playwright.config.ts)
 * remain the run-level log; this is the per-step trace that shows up in the terminal/CI log and,
 * via `test.info().attach`, in the HTML report for a failing test.
 */
export class Logger {
  constructor(private readonly scope: string) {}

  static forScope(scope: string): Logger {
    return new Logger(scope);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  /** Marks a Gherkin step boundary — kept distinct from `info` so step logs are easy to grep for. */
  step(message: string, meta?: Record<string, unknown>): void {
    this.write('step', message, meta);
  }

  /** Tags a scenario's behavior as a documented, known gap rather than a genuine regression. */
  knownGap(reason: string): void {
    this.write('warn', `@KnownGap: ${reason}`);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    const line = `[${timestamp}] [${level.toUpperCase()}] [${this.scope}] ${message}${suffix}`;
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}
