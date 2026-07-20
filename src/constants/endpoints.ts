/** Relative to `Urls.API_BASE_URL`. Centralized so services never inline a path string. */
export const Endpoints = {
  HEALTH: 'health',
  ROUTES: 'routes',
  AUTH: {
    REGISTER: 'auth/register',
    LOGIN: 'auth/login',
  },
  CUSTOMERS: {
    BASE: 'customers',
    SEARCH: 'customers/search',
    byId: (id: string) => `customers/${id}`,
    accounts: (customerId: string) => `customers/${customerId}/accounts`,
    transactions: (customerId: string) => `customers/${customerId}/transactions`,
  },
  ACCOUNTS: {
    byId: (id: string) => `accounts/${id}`,
    TRANSFER: 'accounts/transfer',
  },
} as const;
