/** Parses/formats the app's `${amount.toFixed(2)}` display convention (AccountsTable/TransactionsTable). */
export class CurrencyUtils {
  /** Shared with `accountMatchers.toHaveBalance`'s default tolerance — one source of truth for the
   *  float-tolerance policy (Requirement.md R-8) rather than two independently-maintained literals. */
  static readonly DEFAULT_TOLERANCE = 0.01;

  /** Parses a displayed `"$1,234.56"`-or-`"$100.00"` string back into a number. */
  static parse(displayed: string): number {
    const numeric = displayed.replace(/[^0-9.-]/g, '');
    return Number.parseFloat(numeric);
  }
}
