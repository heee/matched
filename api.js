// Matched — REST calls to the Worker. Same shape as Boys Pushup Bonanza's
// api.js: a small ApiError class, timeout + retry classification, one
// factory that returns a flat set of request functions.

export class ApiError extends Error {
  constructor(message, { status = 0, code = "network_error", retryable = true } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

export function isRetryableError(error) {
  return !(error instanceof ApiError) || error.retryable;
}

export function createWorkerApi({ baseUrl, appKey, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }) {
  const configured = () => !!baseUrl && !baseUrl.includes("YOUR-SUBDOMAIN");

  async function request(path, { method = "GET", body, timeout = timeoutMs } = {}) {
    if (!configured()) throw new ApiError("Worker URL not configured yet.", { code: "not_configured", retryable: false });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-App-Key": appKey },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      throw new ApiError(timedOut ? "Request timed out." : "Network request failed.", {
        code: timedOut ? "timeout" : "network_error",
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text().catch(() => "");
    let payload = {};
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = {}; }
    }
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      throw new ApiError(payload.error || `Request failed (${response.status}).`, {
        status: response.status,
        code: payload.code || `http_${response.status}`,
        retryable,
      });
    }
    return payload;
  }

  return {
    configured,
    fetchData: (scope) => request(`/data${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`),
    fetchUsers: () => request("/data?scope=users"),
    fetchRoom: (roomId) => request(`/room/${encodeURIComponent(roomId)}`),
    registerUser: (user) => request("/register-user", { method: "POST", body: { user } }),
    createRoom: (room) => request("/create-room", { method: "POST", body: room }),
    joinRoom: (roomId, user) => request("/join-room", { method: "POST", body: { roomId, user, started: true } }),
    listRooms: (scope, user) => request(`/list-rooms?scope=${encodeURIComponent(scope)}${user ? `&user=${encodeURIComponent(user)}` : ""}`),
    deleteRoom: (roomId) => request("/delete-room", { method: "POST", body: { roomId } }),
    deleteUser: (user) => request("/delete-user", { method: "POST", body: { user } }),
    completeRoom: (payload) => request("/complete-room", { method: "POST", body: payload }),
    updateRoom: (payload) => request("/update-room", { method: "POST", body: payload }),
    fetchDaily: (date) => request(`/daily${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    reportDailyResult: (result) => request("/daily-result", { method: "POST", body: result }),
    wsUrl(roomId, user) {
      const httpBase = baseUrl.replace(/\/$/, "");
      const wsBase = httpBase.replace(/^http/, "ws");
      return `${wsBase}/room/${encodeURIComponent(roomId)}/connect?user=${encodeURIComponent(user)}`;
    },
  };
}
