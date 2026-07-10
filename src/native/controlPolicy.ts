import { timingSafeEqual } from "node:crypto";

export type ControlRequest = {
  method?: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  token: string;
};

type PolicyResult = { allowed: true } | { allowed: false; status: number; error: string };

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tokenMatches(actual: string | undefined, expected: string): boolean {
  if (!actual?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(actual.slice(7));
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export function authorizeControlRequest(request: ControlRequest): PolicyResult {
  if (request.path === "/ping") {
    return request.method === "GET"
      ? { allowed: true }
      : { allowed: false, status: 405, error: "Method not allowed" };
  }

  if (request.method !== "POST") {
    return { allowed: false, status: 405, error: "State-changing commands require POST" };
  }

  if (!tokenMatches(headerValue(request.headers.authorization), request.token)) {
    return { allowed: false, status: 401, error: "Unauthorized" };
  }

  const origin = headerValue(request.headers.origin);
  const fetchSite = headerValue(request.headers["sec-fetch-site"]);
  if (origin || (fetchSite && fetchSite !== "none")) {
    return { allowed: false, status: 403, error: "Browser-originated commands are forbidden" };
  }

  return { allowed: true };
}
