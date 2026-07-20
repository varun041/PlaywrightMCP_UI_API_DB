import { ApiClient, ApiResult } from '@services/ApiClient';
import { Endpoints } from '@constants/endpoints';
import { ApiErrorResponse, CreateAccountRequestBody, CreateAccountResponse } from '@app-types/domain';

/** create/delete against `/api/customers/:id/accounts` and `/api/accounts/:id` (PageObjectModel.md §8). */
export class AccountApiService {
  constructor(private readonly client: ApiClient) {}

  async create(
    customerId: string,
    body: CreateAccountRequestBody,
  ): Promise<ApiResult<CreateAccountResponse & ApiErrorResponse>> {
    return this.client.post(Endpoints.CUSTOMERS.accounts(customerId), body);
  }

  async delete(accountId: string): Promise<ApiResult<{ message: string } & ApiErrorResponse>> {
    return this.client.delete(Endpoints.ACCOUNTS.byId(accountId));
  }
}
