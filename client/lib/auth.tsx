import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson, setTokens, type Tokens } from "./api";
import {
  applyTokens,
  loadSession,
  type SessionChild,
  type SessionUser,
} from "./session";

type AuthCtx = {
  user: SessionUser | null;
  child: SessionChild | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, childName: string) => Promise<string>;
  verify: (token: string) => Promise<void>;
  google: (idToken: string) => Promise<void>;
  forgot: (email: string) => Promise<string | undefined>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [child, setChild] = useState<SessionChild | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession()
      .then((s) => {
        setUser(s?.user ?? null);
        setChild(s?.child ?? null);
      })
      .finally(() => setReady(true));
  }, []);

  async function hydrateFromTokens(data: Tokens & { user: SessionUser }) {
    const session = await applyTokens(data);
    setUser(session.user);
    setChild(session.child);
  }

  const value: AuthCtx = {
    user,
    child,
    ready,
    async signIn(email, password) {
      const data = await apiJson<Tokens & { user: SessionUser }>("/auth/login", {
        method: "POST",
        data: { email, password },
      });
      await hydrateFromTokens(data);
    },
    async register(name, email, password, childName) {
      const data = await apiJson<{ dev_verify_token: string }>("/auth/register", {
        method: "POST",
        data: { display_name: name, email, password, child_name: childName },
      });
      return data.dev_verify_token;
    },
    async verify(token) {
      const data = await apiJson<Tokens & { user: SessionUser }>("/auth/verify-email", {
        method: "POST",
        data: { token },
      });
      await hydrateFromTokens(data);
    },
    async google(idToken) {
      const data = await apiJson<Tokens & { user: SessionUser }>("/auth/google", {
        method: "POST",
        data: { id_token: idToken },
      });
      await hydrateFromTokens(data);
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
