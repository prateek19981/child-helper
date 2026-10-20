import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson, getTokens, setTokens, type Tokens } from "./api";

type User = { id: string; email: string; display_name: string | null; status: string };
type Child = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_band: string | null;
  language: string;
};

type AuthCtx = {
  user: User | null;
  child: Child | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, childName: string) => Promise<string>;
  verify: (token: string) => Promise<void>;
  google: (idToken: string) => Promise<void>;
  forgot: (email: string) => Promise<string | undefined>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function loadSession(): Promise<{ user: User; child: Child | null } | null> {
  const tokens = await getTokens();
  if (!tokens) return null;
  let user: User;
  try {
    user = await apiJson<User>("/auth/me");
  } catch {
    return null;
  }
  if (user.status !== "active") return { user, child: null };
  const kids = await apiJson<Child[]>("/children");
  return { user, child: kids[0] ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession()
      .then((s) => {
        setUser(s?.user ?? null);
        setChild(s?.child ?? null);
      })
      .finally(() => setReady(true));
  }, []);

  async function applyTokens(data: Tokens & { user: User }) {
    await setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
    const session = await loadSession();
    setUser(session?.user ?? data.user);
    setChild(session?.child ?? null);
  }

  const value: AuthCtx = {
    user,
    child,
    ready,
    async signIn(email, password) {
      const data = await apiJson<Tokens & { user: User }>("/auth/login", {
        method: "POST",
        data: { email, password },
      });
      await applyTokens(data);
    },
    async register(name, email, password, childName) {
      const data = await apiJson<{ dev_verify_token: string }>("/auth/register", {
        method: "POST",
        data: { display_name: name, email, password, child_name: childName },
      });
      return data.dev_verify_token;
    },
    async verify(token) {
      const data = await apiJson<Tokens & { user: User }>("/auth/verify-email", {
        method: "POST",
        data: { token },
      });
      await applyTokens(data);
    },
    async google(idToken) {
      const data = await apiJson<Tokens & { user: User }>("/auth/google", {
        method: "POST",
        data: { id_token: idToken },
      });
      await applyTokens(data);
    },
    async forgot(email) {
      const data = await apiJson<{ dev_reset_token?: string }>("/auth/forgot-password", {
        method: "POST",
        data: { email },
      });
      return data.dev_reset_token;
    },
    async signOut() {
      await setTokens(null);
      setUser(null);
      setChild(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
