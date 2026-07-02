const rawBackendBaseUrl = process.env.BACKEND_API_BASE_URL ?? "http://localhost:8091/api/v1";
// Allow BACKEND_API_BASE_URL to be either the backend root or the versioned API root.
const BACKEND_API_BASE_URL = rawBackendBaseUrl.endsWith("/api/v1")
  ? rawBackendBaseUrl.replace(/\/$/, "")
  : `${rawBackendBaseUrl.replace(/\/$/, "")}/api/v1`;

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(request: Request, { params }: Params): Promise<Response> {
  const { path } = await params;

  if (!path || path.length === 0) {
    return Response.json({ error: "Path is required" }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const targetUrl = `${BACKEND_API_BASE_URL}/${path.join("/")}${requestUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");
  const bootstrapToken = request.headers.get("x-bootstrap-token");

  // Forward only the headers this admin app intentionally exposes to the backend.
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (bootstrapToken) headers.set("x-bootstrap-token", bootstrapToken);

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await upstream.text();
  const responseHeaders = new Headers();
  responseHeaders.set("content-type", upstream.headers.get("content-type") ?? "application/json");

  return new Response(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, ctx: Params) {
  return proxyRequest(request, ctx);
}

export async function POST(request: Request, ctx: Params) {
  return proxyRequest(request, ctx);
}

export async function PATCH(request: Request, ctx: Params) {
  return proxyRequest(request, ctx);
}

export async function PUT(request: Request, ctx: Params) {
  return proxyRequest(request, ctx);
}

export async function DELETE(request: Request, ctx: Params) {
  return proxyRequest(request, ctx);
}
