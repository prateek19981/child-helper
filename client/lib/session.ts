import { apiJson, getTokens, setTokens, type Tokens } from "./api";

export type SessionUser = {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
};

export type SessionChild = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_band: string | null;
  language: string;
};

export type Session = {
  user: SessionUser;
  child: SessionChild | null;
};

export async function loadSession(): Promise<Session | null> {
  const tokens = await getTokens();
  if (!tokens) return null;
  let user: SessionUser;
  try {
    user = await apiJson<SessionUser>("/auth/me");
  } catch {
    return null;
  }
  if (user.status !== "active") return { user, child: null };
  const kids = await apiJson<SessionChild[]>("/children");
  return { user, child: kids[0] ?? null };
}

/** Persist tokens and reload `/auth/me` + primary child. */
export async function applyTokens(data: Tokens & { user: SessionUser }): Promise<Session> {
  await setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
  const session = await loadSession();
  return {
    user: session?.user ?? data.user,
    child: session?.child ?? null,
  };
}
