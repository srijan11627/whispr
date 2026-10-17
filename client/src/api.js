// Tiny REST helper. In dev the Vite proxy forwards /api -> :5000.
// When the built client is served by the Express server, same-origin works.
const BASE = import.meta.env.VITE_SERVER_URL || "";

export function getToken() { return localStorage.getItem("whispr-token"); }
export function setToken(t) { t ? localStorage.setItem("whispr-token", t) : localStorage.removeItem("whispr-token"); }

async function req(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (form) opts.body = form; // FormData: browser sets the content-type
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (username, password, displayName) => req("/api/auth/register", { method: "POST", body: { username, password, displayName } }),
  login: (username, password) => req("/api/auth/login", { method: "POST", body: { username, password } }),
  me: () => req("/api/auth/me"),
  searchUsers: (q) => req(`/api/users?q=${encodeURIComponent(q)}`),
  myCircles: () => req("/api/circles"),
  createCircle: (name) => req("/api/circles", { method: "POST", body: { name } }),
  joinCircle: (code) => req("/api/circles/join", { method: "POST", body: { code } }),
  circleMembers: (id) => req(`/api/circles/${id}/members`),
  myDms: () => req("/api/dms"),
  getOrCreateDm: (userId) => req("/api/dms", { method: "POST", body: { userId } }),
  messages: (chatType, chatId, { limit = 60, before } = {}) =>
    req(`/api/messages/${chatType}/${chatId}?limit=${limit}${before ? `&before=${before}` : ""}`),
  searchMessages: (q, chatType, chatId) =>
    req(`/api/search?q=${encodeURIComponent(q)}${chatType ? `&chatType=${chatType}&chatId=${chatId}` : ""}`),
  deleteMessage: (id) => req(`/api/messages/${id}`, { method: "DELETE" }),
  getThemes: () => req("/api/themes"),
  setTheme: (chatKey, theme) => req("/api/themes", { method: "PUT", body: { chatKey, theme } }),
  upload: async (file) => {
    const form = new FormData();
    form.append("file", file);
    return req("/api/upload", { method: "POST", form });
  },
};

// Resolve an attachment/file URL against the API server origin.
export function fileUrl(url) {
  if (!url) return url;
  return url.startsWith("/") ? `${BASE}${url}` : url;
}
