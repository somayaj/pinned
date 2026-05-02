import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { exchangeGoogleIdToken } from "../lib/api";
import { getApiBaseUrl } from "../lib/config";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "pinned_session_token";
const USER_KEY = "pinned_session_user";

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

const extra = Constants.expoConfig?.extra as
  | {
      googleWebClientId?: string;
      googleIosClientId?: string;
      googleAndroidClientId?: string;
    }
  | undefined;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: extra?.googleWebClientId ?? "",
    iosClientId: extra?.googleIosClientId,
    androidClientId: extra?.googleAndroidClientId,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, u] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
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

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) {
      setSignInError("No ID token from Google");
      return;
    }
    let cancelled = false;
    (async () => {
      setSigningIn(true);
      setSignInError(null);
      try {
        const base = await getApiBaseUrl();
        const data = await exchangeGoogleIdToken(base, idToken);
        if (cancelled) return;
        setAccessToken(data.token);
        setUser(data.user);
        await SecureStore.setItemAsync(TOKEN_KEY, data.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
      } catch (e) {
        if (!cancelled) {
          setSignInError(e instanceof Error ? e.message : "Sign-in failed");
        }
      } finally {
        if (!cancelled) setSigningIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [response]);

  const promptGoogleSignIn = useCallback(async () => {
    setSignInError(null);
    if (!request) {
      setSignInError("Google auth is not configured (missing client IDs).");
      return;
    }
    await promptAsync();
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
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
      <View className="flex-1 items-center justify-center bg-white">
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
