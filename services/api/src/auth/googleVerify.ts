import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

function audiences(): string[] {
  const raw = process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_CLIENT_ID;
  if (!raw?.trim()) {
    throw new Error(
      "Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID to your Google OAuth client IDs"
    );
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type GoogleProfile = {
  googleSub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences(),
  });
  const p = ticket.getPayload();
  if (!p?.sub) {
    throw new Error("invalid_google_token");
  }
  return {
    googleSub: p.sub,
    email: p.email ?? null,
    name: p.name ?? null,
    picture: p.picture ?? null,
  };
}
