import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthUser,
  bootstrapAuthToken,
  clearStoredUser,
  getStoredUser,
  persistUser,
  setAuthToken,
  api,
} from "@/api/client";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await bootstrapAuthToken();
      const stored = await getStoredUser<AuthUser>();
      if (stored) setUserState(stored);
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (token: string, nextUser: AuthUser) => {
    await setAuthToken(token);
    await persistUser(nextUser);
    setUserState(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    // Unregister push tokens before clearing auth
    try {
      await api.unregisterAllPushTokens();
    } catch {
      // Best effort — don't block signout if server is unreachable
    }
    await setAuthToken(null);
    await clearStoredUser();
    setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, signIn, signOut, setUser: setUserState }),
    [user, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
