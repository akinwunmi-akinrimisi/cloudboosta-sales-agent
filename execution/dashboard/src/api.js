/**
 * Authenticated fetch wrapper for dashboard API calls.
 *
 * All dashboard endpoints require a bearer token stored in localStorage.
 * On 401 responses, the token is cleared and the page is reloaded to
 * prompt re-authentication.
 */

const TOKEN_KEY = "dashboard_token";

/** Retrieve the stored dashboard token. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Store the dashboard authentication token. */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the stored token (logout / expiry). */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Authenticated GET request to a dashboard API endpoint.
 *
 * @param {string} path - Path segment appended to /api/dashboard (e.g. "/live").
 * @returns {Promise<object>} Parsed JSON response.
 * @throws {Error} On non-2xx responses (except 401 which triggers reload).
 */
export async function apiFetch(path) {
  const token = getToken();
  const res = await fetch(`/api/dashboard${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Authenticated POST request to a dashboard API endpoint.
 *
 * @param {string} path - Path segment appended to /api/dashboard (e.g. "/call/stop").
 * @param {object} body - JSON body to send with the request.
 * @returns {Promise<object>} Parsed JSON response.
 * @throws {Error} On non-2xx responses (except 401 which triggers reload).
 */
export async function apiPost(path, body = {}) {
  const token = getToken();
  const res = await fetch(`/api/dashboard${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API error: ${res.status}`);
  }

  return res.json();
}
