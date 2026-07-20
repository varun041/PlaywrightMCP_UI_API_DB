import { ApiClient, ApiResult } from '@services/ApiClient';
import { Endpoints } from '@constants/endpoints';
import { ApiErrorResponse, AuthSuccessResponse, LoginRequestBody, RegisterRequestBody } from '@app-types/domain';

/** `register`/`login` against `/api/auth/*` — the only two endpoints that require no prior auth. */
export class AuthApiService {
  constructor(private readonly client: ApiClient) {}

  async register(body: Partial<RegisterRequestBody>): Promise<ApiResult<AuthSuccessResponse & ApiErrorResponse>> {
    return this.client.post(Endpoints.AUTH.REGISTER, body);
  }

  async login(body: Partial<LoginRequestBody>): Promise<ApiResult<AuthSuccessResponse & ApiErrorResponse>> {
    return this.client.post(Endpoints.AUTH.LOGIN, body);
  }
}
