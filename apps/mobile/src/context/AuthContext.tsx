import * as Google from "expo-auth-session/providers/google";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { getGoogleClientIds } from "../config/googleClients";
import { exchangeGoogleIdToken } from "../lib/api";
import { getApiBaseUrl } from "../lib/config";
import {
  deleteSessionItem,
  getSessionItem,
  setSessionItem,
} from "../lib/sessionStore";

const TOKEN_KEY = "pinned_session_token";
const USER_KEY = "pinned_session_user";
/** Web full-page OAuth: state we stored before redirect to Google. */
const WEB_OAUTH_STATE_KEY = "pinned_google_oauth_state";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

type AuthContextValue = {
  user: SessionUser | null;
  accessToken: string | null;
  ready: boolean;
  signingIn: boolean;
  signInError: string | null;
  promptGoogleSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const googleAuthConfig = useMemo(() => getGoogleClientIds(), []);

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleAuthConfig.webClientId,
    iosClientId: googleAuthConfig.iosClientId,
    androidClientId: googleAuthConfig.androidClientId,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          window.location.hash
        ) {
          const raw = window.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(raw);
          if (params.get("error")) {
            const msg =
              params.get("error_description") ||
              params.get("error") ||
              "Google sign-in was cancelled.";
            if (!cancelled) setSignInError(decodeURIComponent(msg));
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          } else if (raw.includes("id_token")) {
            const idToken = params.get("id_token");
            const state = params.get("state");
            const expected =
              typeof sessionStorage !== "undefined"
                ? sessionStorage.getItem(WEB_OAUTH_STATE_KEY)
                : null;
            if (idToken && (!expected || state === expected)) {
              if (typeof sessionStorage !== "undefined") {
                sessionStorage.removeItem(WEB_OAUTH_STATE_KEY);
              }
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
              if (!cancelled) setSigningIn(true);
              try {
                const base = await getApiBaseUrl();
                const data = await exchangeGoogleIdToken(base, idToken);
                if (cancelled) return;
                setAccessToken(data.token);
                setUser(data.user);
                await setSessionItem(TOKEN_KEY, data.token);
                await setSessionItem(USER_KEY, JSON.stringify(data.user));
              } catch (e) {
                if (!cancelled) {
                  setSignInError(
                    e instanceof Error ? e.message : "Sign-in failed",
                  );
                }
              } finally {
                if (!cancelled) setSigningIn(false);
              }
              if (!cancelled) setReady(true);
              return;
            }
            if (!cancelled) {
              setSignInError(
                "Sign-in session mismatch. Close this tab and try again.",
              );
            }
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }
        }

        const [t, u] = await Promise.all([
          getSessionItem(TOKEN_KEY),
          getSessionItem(USER_KEY),
        ]);
        if (cancelled) return;
        if (t && u) {
          setAccessToken(t);
          setUser(JSON.parse(u) as SessionUser);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeSignInWithIdToken = useCallback(async (idToken: string) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const base = await getApiBaseUrl();
      const data = await exchangeGoogleIdToken(base, idToken);
      setAccessToken(data.token);
      setUser(data.user);
      await setSessionItem(TOKEN_KEY, data.token);
      await setSessionItem(USER_KEY, JSON.stringify(data.user));
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }, []);

  const promptGoogleSignIn = useCallback(async () => {
    setSignInError(null);
    if (!request) {
      setSignInError("Google auth is not configured (missing client IDs).");
      return;
    }

    /**
     * Popup OAuth breaks with Google's Cross-Origin-Opener-Policy (window.closed).
     * Same-tab redirect avoids popups entirely.
     */
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const authUrl = request.url;
      if (!authUrl) {
        setSignInError("Sign-in is still loading. Try again in a second.");
        return;
      }
      try {
        const u = new URL(authUrl);
        const st = u.searchParams.get("state");
        if (st && typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(WEB_OAUTH_STATE_KEY, st);
        }
      } catch {
        /* still redirect */
      }
      window.location.assign(authUrl);
      return;
    }

    const result = await promptAsync();
    if (!result || result.type !== "success") {
      if (result?.type === "error") {
        const err = result.error as { message?: string } | undefined;
        setSignInError(
          err?.message ??
            "Google sign-in failed (try again or use another browser)."
        );
      }
      return;
    }
    const idToken = result.params?.id_token;
    if (!idToken) {
      setSignInError("No ID token from Google");
      return;
    }
    await completeSignInWithIdToken(idToken);
  }, [request, promptAsync, completeSignInWithIdToken]);

  const signOut = useCallback(async () => {
    await deleteSessionItem(TOKEN_KEY);
    await deleteSessionItem(USER_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      ready,
      signingIn,
      signInError,
      promptGoogleSignIn,
      signOut,
    }),
    [
      user,
      accessToken,
      ready,
      signingIn,
      signInError,
      promptGoogleSignIn,
      signOut,
    ]
  );

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-100">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="mt-3 text-slate-500">Loading…</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
