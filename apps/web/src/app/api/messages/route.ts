const DEFAULT_API_URL = "http://localhost:3001";
const LIST_MESSAGES_TIMEOUT_MS = 15_000;
const SEND_MESSAGE_TIMEOUT_MS = 120_000;

export async function GET(request: Request): Promise<Response> {
  return proxyMessagesRequest(request, "GET");
}

export async function POST(request: Request): Promise<Response> {
  return proxyMessagesRequest(request, "POST");
}

async function proxyMessagesRequest(request: Request, method: "GET" | "POST") {
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal]);
  let didTimeOut = false;
  const timeoutId = globalThis.setTimeout(
    () => {
      didTimeOut = true;
      controller.abort();
    },
    method === "GET" ? LIST_MESSAGES_TIMEOUT_MS : SEND_MESSAGE_TIMEOUT_MS,
  );

  try {
    const requestUrl = new URL(request.url);
    const upstreamUrl = new URL("/messages", process.env.API_URL ?? DEFAULT_API_URL);
    upstreamUrl.search = requestUrl.search;

    const headers = new Headers();
    copyHeader(request.headers, headers, "accept");
    copyHeader(request.headers, headers, "content-type");

    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body: method === "POST" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal,
    });

    const responseHeaders = new Headers();
    copyHeader(upstreamResponse.headers, responseHeaders, "content-type");
    copyHeader(upstreamResponse.headers, responseHeaders, "x-request-id");
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch {
    const status = didTimeOut ? 504 : request.signal.aborted ? 499 : 502;
    const response = Response.json(
      {
        code: 2,
        message: getProxyErrorMessage(status),
        data: null,
      },
      { status },
    );

    response.headers.set("x-request-id", crypto.randomUUID());
    response.headers.set("cache-control", "no-store");
    return response;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function getProxyErrorMessage(status: number) {
  if (status === 499) {
    return "The request was cancelled.";
  }

  return status === 504
    ? "The LifeInbox API took too long to respond."
    : "The LifeInbox API is unavailable.";
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);

  if (value !== null) {
    target.set(name, value);
  }
}
