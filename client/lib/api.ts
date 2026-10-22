import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

function metroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
      ?.expoClient?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string; hostUri?: string } }).manifest?.debuggerHost ??
    (Constants as { manifest?: { hostUri?: string } }).manifest?.hostUri;
  if (!hostUri || typeof hostUri !== "string") return null;
  const host = hostUri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  // Tunnel hosts (*.exp.direct) are not the API machine
  if (host.includes("exp.direct") || host.includes("expo.dev")) return null;
  return host;
}

function resolveApiBaseUrl() {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

  // Public tunnel / production URLs: use as-is
  if (configured.startsWith("https://") || configured.includes("trycloudflare.com") || configured.includes("ngrok")) {
    return configured;
  }

  // Keep API on the same LAN host Expo Metro is using (avoids stale .env IPs)
  try {
    const url = new URL(configured);
    const host = metroHost();
    if (host && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname))) {
      url.hostname = host;
    }
    if (Platform.OS === "android" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      url.hostname = "10.0.2.2";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}

const API = resolveApiBaseUrl();
if (__DEV__) {
  console.log("[api] base URL:", API);
}

export function getApiBaseUrl(): string {
  return API;
}

export type Tokens = { access_token: string; refresh_token: string };

const SKIP_AUTH = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/verify-email",
  "/auth/google",
]);

export async function getTokens(): Promise<Tokens | null> {
  const raw = await SecureStore.getItemAsync("tokens");
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export async function setTokens(t: Tokens | null) {
  if (!t) await SecureStore.deleteItemAsync("tokens");
  else await SecureStore.setItemAsync("tokens", JSON?.stringify(t));
}

function errorMessage(error: AxiosError): string {
  const data = error.response?.data as { detail?: unknown } | undefined;
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail != null) return JSON?.stringify?.(detail);
  if (error.message === "Network Error") {
    return `Cannot reach API at ${API}. On corp Wi‑Fi use a public tunnel (cloudflared) in EXPO_PUBLIC_API_URL and Expo --tunnel.`;
  }
  return error.message || "Request failed";
}

export function toApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) return new Error(errorMessage(error));
  if (error instanceof Error) return error;
  return new Error("Request failed");
}

const refreshClient = axios.create({
  baseURL: API,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

async function refreshTokens(refresh_token: string): Promise<Tokens | null> {
  try {
    const { data } = await refreshClient.post<Tokens>("/auth/refresh", { refresh_token });
    const next = { access_token: data.access_token, refresh_token: data.refresh_token };
    await setTokens(next);
    return next;
  } catch {
    await setTokens(null);
    return null;
  }
}

export const http = axios.create({
  baseURL: API,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

let refreshQueue: Promise<Tokens | null> | null = null;

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (__DEV__) {
    const method = (config.method ?? "get").toUpperCase();
    console.log(`[api] → ${method} ${config.baseURL ?? ""}${config.url ?? ""}`);
  }
  const path = config.url ?? "";
  if (SKIP_AUTH.has(path)) return config;
  const tokens = await getTokens();
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const method = (response.config.method ?? "get").toUpperCase();
      console.log(`[api] ← ${response.status} ${method} ${response.config.url ?? ""}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    if (__DEV__) {
      const cfg = error.config;
      const method = (cfg?.method ?? "get").toUpperCase();
      console.log(
        `[api] ← ${error.response?.status ?? "ERR"} ${method} ${cfg?.url ?? ""}`,
        error.response?.data ?? error.message
      );
    }
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    if (!original || original._retry || status !== 401) {
      return Promise.reject(toApiError(error));
    }

    const path = original.url ?? "";
    if (SKIP_AUTH.has(path)) {
      return Promise.reject(toApiError(error));
    }

    original._retry = true;
    const tokens = await getTokens();
    if (!tokens?.refresh_token) {
      return Promise.reject(toApiError(error));
    }

    if (!refreshQueue) {
      refreshQueue = refreshTokens(tokens.refresh_token).finally(() => {
        refreshQueue = null;
      });
    }
    const next = await refreshQueue;
    if (!next) {
      return Promise.reject(toApiError(error));
    }
    original.headers.Authorization = `Bearer ${next.access_token}`;
    return http.request(original);
  }
);

export async function apiJson<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.request<T>({ url, ...config });
  return data;
}
