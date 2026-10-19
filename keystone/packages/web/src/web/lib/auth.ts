import { createAuthClient } from "better-auth/react";
import { managedAuthClient } from "@runablehq/managed-auth/client";

const TOKEN_KEY = "runable.managed-auth.token";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_WEBSITE_URL ?? window.location.origin,
  basePath: "/api/auth",
  plugins: [
    managedAuthClient({
      applicationId: import.meta.env.VITE_APPLICATION_ID,
      issuer: import.meta.env.VITE_RUNABLE_AUTH_ISSUER,
    }),
  ],
});

// Complete a returning managed (Google) sign-in before anything renders. Every module that
// touches auth imports this file, so the app bootstrap waits on it.
await authClient.managedAuth.handleRedirect();

/** Capture the bearer token for email/password flows (works inside the cross-origin preview iframe). */
function capture(ctx: { response: Response }) {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export async function emailSignIn(email: string, password: string) {
  return authClient.signIn.email({ email, password }, { onSuccess: capture });
}

export async function emailSignUp(name: string, email: string, password: string) {
  return authClient.signUp.email({ name, email, password }, { onSuccess: capture });
}

export async function signOut() {
  await authClient.signOut();
  localStorage.removeItem(TOKEN_KEY);
}
