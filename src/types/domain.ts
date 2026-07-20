import { AccountStatus } from '@enums/AccountStatus';
import { TransactionStatus } from '@enums/TransactionStatus';

/** Raw row shape of `tests/DB/banking.db`'s `customers` table, and the shape `GET /customers/:id` returns. */
export interface CustomerRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zipCode: string | null;
  address_country: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

/** Request body for `POST /customers` (nested `address`, unlike the flat `CustomerRecord` response shape). */
export interface CreateCustomerRequestBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: AddressInput;
}

export interface CreateCustomerResponse {
  id: string;
  message: string;
}

/** Raw row shape of the `accounts` table. */
export interface AccountRecord {
  id: string;
  customerId: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  currency: string;
  status: AccountStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequestBody {
  accountType?: string;
  balance?: number | null;
  currency?: string;
}

export interface CreateAccountResponse {
  id: string;
  accountNumber: string;
  message: string;
}

/** Raw row shape of the `transactions` table. */
export interface TransactionRecord {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  description: string;
  reference: string | null;
  status: TransactionStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferRequestBody {
  fromAccountId?: string;
  toAccountNumber?: string;
  amount?: number | string;
  description?: string;
}

export interface TransferResponse {
  message: string;
  reference: string;
}

/** Raw row shape of the `users` table (backend's own DB — not `tests/DB/banking.db`). */
export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface RegisterRequestBody {
  username?: string;
  password?: string;
  email?: string;
}

export interface AuthSuccessResponse {
  message: string;
  token: string;
  userId: string;
}

export interface LoginRequestBody {
  username?: string;
  password?: string;
}

export interface ApiErrorResponse {
  error: string;
}

export interface CustomerListResponse {
  customers: CustomerRecord[];
  total: number;
}

export interface CustomerSearchResponse {
  customers: CustomerRecord[];
}

export interface AccountsResponse {
  accounts: AccountRecord[];
}

export interface TransactionsResponse {
  transactions: TransactionRecord[];
}

export interface HealthResponse {
  status: string;
}

export interface RoutesResponse {
  routes: Array<{ method: string; path: string }>;
}

/** The `{ userId }` payload `jsonwebtoken` signs, plus its standard `iat`/`exp` claims. */
export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}
