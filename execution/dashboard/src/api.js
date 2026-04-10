/**
 * Authenticated fetch wrapper for CRM dashboard API calls.
 *
 * All endpoints require a bearer token stored in localStorage.
 * On 401 responses, the token is cleared and the page is reloaded.
 */

const TOKEN_KEY = "dashboard_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
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

export function apiFetch(path) {
  return request(path);
}

export function apiPost(path, body = {}) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPut(path, body = {}) {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

export async function apiUpload(path, file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload error: ${res.status}`);
  }

  return res.json();
}

/**
 * Legacy fetch for existing components still using /api/dashboard/* paths.
 * Remove after all components are migrated to new routes.
 */
export function legacyFetch(path) {
  const token = getToken();
  return fetch(`/api/dashboard${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }).then((res) => {
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      return;
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });
}

export function legacyPost(path, body = {}) {
  const token = getToken();
  return fetch(`/api/dashboard${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then((res) => {
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      return;
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });
}
