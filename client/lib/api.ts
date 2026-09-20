import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

function resolveApiBaseUrl() {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  if (Platform.OS !== "android") return configured;
  try {
    const url = new URL(configured);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.hostname = "10.0.2.2";
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return configured;
  }
  return configured;
}

const API = resolveApiBaseUrl();

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
    return `Cannot reach API at ${API}. On a physical phone use your computer's LAN IP (EXPO_PUBLIC_API_URL).`;
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
  const path = config.url ?? "";
  if (SKIP_AUTH.has(path)) return config;
  const tokens = await getTokens();
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
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
  console.log("apiJson", url, config);
  const { data } = await http.request<T>({ url, ...config });
  return data;
}
