import type { FetchFunction, HttpHost } from '../types/http';

const headersToRecord = (headers: HeadersInit): Record<string, string> => {
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers;
};

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function createFetchFromHost(host: HttpHost): FetchFunction {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const isRequest = input instanceof Request;
    const url = String(isRequest ? input.url : input);
    const requestHeaders = isRequest
      ? headersToRecord(input.headers)
      : undefined;
    const initHeaders = init?.headers
      ? headersToRecord(init.headers)
      : undefined;
    const headers =
      requestHeaders || initHeaders
        ? { ...requestHeaders, ...initHeaders }
        : undefined;
    const method = init?.method ?? (isRequest ? input.method : undefined);
    const body = typeof init?.body === 'string' ? init.body : undefined;

    const response = await host.fetch(url, {
      method,
      headers,
      body,
    });

    const responseBody = NULL_BODY_STATUSES.has(response.status)
      ? null
      : response.body;

    return new Response(responseBody, {
      status: response.status,
      headers: new Headers(response.headers),
    });
  };
}

const noopHost: HttpHost = {
  fetch: async () => ({
    status: 501,
    headers: {},
    body: 'HTTP host not configured',
  }),
};

export class HttpAPI {
  readonly fetch: FetchFunction;

  constructor(host?: HttpHost) {
    this.fetch = createFetchFromHost(host ?? noopHost);
  }
}
