/**
 * Exact backend error-response strings (every route returns `{ error: string }`; see
 * banking-app/backend/routes/*.js and middleware/auth.js). Centralized so assertions never
 * hardcode a message inline and so a genuine backend wording change fails loudly in one place.
 */
export const ApiMessages = {
  auth: {
    missingRegisterFields: 'Missing required fields',
    usernameExists: 'Username already exists',
    missingLoginFields: 'Username and password required',
    invalidCredentials: 'Invalid credentials',
  },
  token: {
    required: 'Access token required',
    invalidOrExpired: 'Invalid or expired token',
  },
  customers: {
    searchQueryRequired: 'Search query required',
    notFound: 'Customer not found',
    missingCreateFields: 'Missing required fields',
  },
  accounts: {
    accountTypeRequired: 'Account type is required',
    customerNotFound: 'Customer not found',
    notFound: 'Account not found',
  },
  transfer: {
    missingOrInvalidAmount:
      'From account, destination account number, and a positive amount are required',
    sourceNotFound: 'Source account not found',
    destinationNotFound: 'Destination account not found',
    sameAccount: 'Cannot transfer to the same account',
    accountsMustBeActive: 'Both accounts must be active',
    insufficientFunds: 'Insufficient funds',
  },
  health: {
    running: 'Banking API is running',
  },
} as const;
