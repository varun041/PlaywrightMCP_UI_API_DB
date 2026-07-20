import { ApiClient, ApiResult } from '@services/ApiClient';
import { Endpoints } from '@constants/endpoints';
import { SearchFilter } from '@enums/SearchFilter';
import {
  AccountsResponse,
  ApiErrorResponse,
  CreateCustomerRequestBody,
  CreateCustomerResponse,
  CustomerListResponse,
  CustomerRecord,
  CustomerSearchResponse,
} from '@app-types/domain';

export interface ListCustomersOptions {
  limit?: number;
  offset?: number;
}

export interface SearchCustomersOptions {
  query?: string;
  filter?: SearchFilter;
}

/** CRUD + search/pagination against `/api/customers` (PageObjectModel.md §8). */
export class CustomerApiService {
  constructor(private readonly client: ApiClient) {}

  async list(options: ListCustomersOptions = {}): Promise<ApiResult<CustomerListResponse>> {
    return this.client.get(Endpoints.CUSTOMERS.BASE, {
      params: { ...(options.limit !== undefined ? { limit: options.limit } : {}), ...(options.offset !== undefined ? { offset: options.offset } : {}) },
    });
  }

  async search(options: SearchCustomersOptions): Promise<ApiResult<CustomerSearchResponse & ApiErrorResponse>> {
    return this.client.get(Endpoints.CUSTOMERS.SEARCH, {
      params: {
        ...(options.query !== undefined ? { query: options.query } : {}),
        ...(options.filter ? { filter: options.filter } : {}),
      },
    });
  }

  async getById(customerId: string): Promise<ApiResult<CustomerRecord & ApiErrorResponse>> {
    return this.client.get(Endpoints.CUSTOMERS.byId(customerId));
  }

  async create(body: CreateCustomerRequestBody): Promise<ApiResult<CreateCustomerResponse & ApiErrorResponse>> {
    return this.client.post(Endpoints.CUSTOMERS.BASE, body);
  }

  async update(customerId: string, body: Partial<CreateCustomerRequestBody>): Promise<ApiResult<{ message: string }>> {
    return this.client.put(Endpoints.CUSTOMERS.byId(customerId), body);
  }

  async delete(customerId: string): Promise<ApiResult<{ message: string }>> {
    return this.client.delete(Endpoints.CUSTOMERS.byId(customerId));
  }

  async getAccounts(customerId: string): Promise<ApiResult<AccountsResponse>> {
    return this.client.get(Endpoints.CUSTOMERS.accounts(customerId));
  }
}
