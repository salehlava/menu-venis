/* Thin fetch wrapper for the admin API.
   On the published GitHub Pages site there is no server, so the same calls are
   answered by github.js instead (see VENICE_MODE in admin/js/config.js). */
import { githubRequest, isGithubMode } from "./github.js";

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
  if (isGithubMode()) return githubBacked(method, url, body);

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

async function githubBacked(method, url, body) {
  try {
    return await githubRequest(method, url, body);
  } catch (err) {
    if (err.status === 401 && !url.endsWith("/login")) {
      window.dispatchEvent(new CustomEvent("auth:required"));
    }
    throw new ApiError(err.status || 500, { error: err.code, message: err.message, field: err.field });
  }
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  put: (url, body = {}) => request("PUT", url, body),
  del: (url) => request("DELETE", url),
};
