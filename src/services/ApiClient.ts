import { APIRequestContext } from '@playwright/test';
import { Logger } from '@utils/Logger';

export interface ApiResult<T> {
  status: number;
  headers: Record<string, string>;
  /** Best-effort parsed JSON body; `{}` for a non-JSON or empty response rather than throwing. */
  body: T;
  /** Always available, even when the response isn't valid JSON (malformed-body scenarios). */
  text: string;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
}

/**
 * The only class that talks to `request.newContext()`/injects the bearer header — every
 * `*ApiService` composes this rather than duplicating HTTP plumbing (PlaywrightAutomationArchitecture.md §5).
 * `authorizationHeaderValue` is stored pre-formatted (e.g. `"Bearer <token>"`, a bare token with no
 * scheme, or `undefined`) so session/security scenarios can exercise malformed auth headers without
 * this class assuming any particular scheme.
 */
export class ApiClient {
  private readonly logger = Logger.forScope('ApiClient');

  constructor(
    private readonly request: APIRequestContext,
    private readonly authorizationHeaderValue?: string,
  ) {}

  /** Returns a new client bound to the same underlying context with a different (or absent) auth header. */
  withAuthorizationHeader(value: string | undefined): ApiClient {
    return new ApiClient(this.request, value);
  }

  async get<T = Record<string, unknown>>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const response = await this.request.get(path, {
      params: options.params,
      headers: this.mergeHeaders(options.headers),
    });
    return this.toResult<T>(response, 'GET', path);
  }

  async post<T = Record<string, unknown>>(path: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const response = await this.request.post(path, {
      data,
      headers: this.mergeHeaders(options.headers),
    });
    return this.toResult<T>(response, 'POST', path);
  }

  async put<T = Record<string, unknown>>(path: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const response = await this.request.put(path, {
      data,
      headers: this.mergeHeaders(options.headers),
    });
    return this.toResult<T>(response, 'PUT', path);
  }

  async delete<T = Record<string, unknown>>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const response = await this.request.delete(path, {
      headers: this.mergeHeaders(options.headers),
    });
    return this.toResult<T>(response, 'DELETE', path);
  }

  /** Escape hatch for deliberately-malformed bodies/headers (VAL-07/VAL-08-style scenarios) — bypasses JSON.stringify. */
  async postRaw<T = Record<string, unknown>>(path: string, rawBody: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const response = await this.request.post(path, {
      data: rawBody,
      headers: this.mergeHeaders(options.headers),
    });
    return this.toResult<T>(response, 'POST(raw)', path);
  }

  private mergeHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.authorizationHeaderValue !== undefined && headers['Authorization'] === undefined) {
      headers['Authorization'] = this.authorizationHeaderValue;
    }
    return headers;
  }

  private async toResult<T>(
    response: Awaited<ReturnType<APIRequestContext['get']>>,
    method: string,
    path: string,
  ): Promise<ApiResult<T>> {
    const text = await response.text();
    let body: T;
    try {
      body = text.length > 0 ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      body = {} as T;
    }
    this.logger.info(`${method} ${path} -> ${response.status()}`);
    return { status: response.status(), headers: response.headers(), body, text };
  }
}
