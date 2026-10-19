import "server-only";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL?.replace(/^https?:\/\//, (m) => m) ??
    "http://localhost:3000"
  );
}

export function googleConfig(): OAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl()}/api/calendar/oauth/google/callback`,
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  };
}

export function microsoftConfig(): OAuthConfig | null {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT ?? "common";
  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl()}/api/calendar/oauth/microsoft/callback`,
    scopes: [
      "Calendars.ReadWrite",
      "offline_access",
      "User.Read",
      "openid",
    ],
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

export function configFor(provider: "google" | "microsoft"): OAuthConfig | null {
  return provider === "google" ? googleConfig() : microsoftConfig();
}
