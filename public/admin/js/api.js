/* Thin fetch wrapper for the admin API. */

export class ApiError extends Error {
  constructor(status, body) {
    super(body.message || body.error || `HTTP ${status}`);
    this.status = status;
    this.code = body.error;
    this.field = body.field;
    this.body = body;
  }
}

async function request(method, url, body) {
  const headers = { "X-Venice-Admin": "1" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { error: "network" });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    if (res.status === 401 && !url.endsWith("/login") && !url.endsWith("/account")) {
      window.dispatchEvent(new CustomEvent("auth:required"));
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  put: (url, body = {}) => request("PUT", url, body),
  del: (url) => request("DELETE", url),
};
