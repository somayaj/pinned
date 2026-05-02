import jwt, { type SignOptions } from "jsonwebtoken";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET must be set to a long random string (at least 16 characters)"
    );
  }
  return secret;
}

export function signSessionToken(userId: string): string {
  const opts: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign({ sub: userId }, getSecret(), opts);
}

export function verifySessionToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, getSecret()) as { sub: string };
  if (!decoded.sub) {
    throw new Error("invalid_token");
  }
  return decoded;
}
