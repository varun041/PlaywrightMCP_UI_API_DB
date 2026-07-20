import { ApiClient, ApiResult } from '@services/ApiClient';
import { Endpoints } from '@constants/endpoints';
import { ApiErrorResponse, TransferRequestBody, TransferResponse } from '@app-types/domain';

/** `/api/accounts/transfer`, including the concurrent/retry call patterns used by fund_transfer_resilience.feature. */
export class TransferApiService {
  constructor(private readonly client: ApiClient) {}

  async transfer(body: TransferRequestBody): Promise<ApiResult<TransferResponse & ApiErrorResponse>> {
    return this.client.post(Endpoints.ACCOUNTS.TRANSFER, body);
  }

  /** Fires the identical request twice back-to-back — models "client retried after a timeout, first request didn't actually fail". */
  async transferThenRetry(
    body: TransferRequestBody,
  ): Promise<[ApiResult<TransferResponse & ApiErrorResponse>, ApiResult<TransferResponse & ApiErrorResponse>]> {
    const first = await this.transfer(body);
    const retry = await this.transfer(body);
    return [first, retry];
  }

  /** Fires N transfer requests as close to simultaneously as possible — the concurrency-race probes (CONC-01/CONC-04). */
  async transferConcurrently(
    bodies: TransferRequestBody[],
  ): Promise<Array<ApiResult<TransferResponse & ApiErrorResponse>>> {
    return Promise.all(bodies.map((body) => this.transfer(body)));
  }
}
