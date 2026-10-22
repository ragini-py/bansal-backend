import { OAuth2Client } from "google-auth-library";
import { BadRequestError, UnauthorizedError } from "../../common/app-error.js";
import { env } from "../../config/env.js";

const client = new OAuth2Client();

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  picture?: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    throw new BadRequestError("Google ID token is required.");
  }

  const token = idToken.trim();

  // 1. Try Google Auth Library verifyIdToken
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.google.clientId ? [env.google.clientId] : undefined,
    });
    const payload = ticket.getPayload();
    if (payload && payload.email) {
      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase().trim(),
        emailVerified: Boolean(payload.email_verified),
        firstName: payload.given_name || payload.name?.split(" ")[0] || "Valued",
        lastName: payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "",
        picture: payload.picture,
      };
    }
  } catch {
    // Continue to fallback verifications below
  }

  // 2. Fall back to Google's tokeninfo endpoint (ID token)
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
    );
    if (response.ok) {
      const info = (await response.json()) as {
        sub?: string;
        email?: string;
        email_verified?: string | boolean;
        given_name?: string;
        family_name?: string;
        name?: string;
        picture?: string;
        aud?: string;
      };

      if (info.email && info.sub) {
        if (env.google.clientId && info.aud && info.aud !== env.google.clientId) {
          throw new UnauthorizedError("Google token audience mismatch with server configuration.");
        }

        return {
          googleId: info.sub,
          email: info.email.toLowerCase().trim(),
          emailVerified: info.email_verified === "true" || info.email_verified === true,
          firstName: info.given_name || info.name?.split(" ")[0] || "Valued",
          lastName: info.family_name || info.name?.split(" ").slice(1).join(" ") || "",
          picture: info.picture,
        };
      }
    }
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) throw err;
  }

  // 3. Fall back to OAuth2 userinfo endpoint (OAuth access token)
  try {
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (userinfoRes.ok) {
      const info = (await userinfoRes.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        given_name?: string;
        family_name?: string;
        name?: string;
        picture?: string;
      };

      if (info.email && info.sub) {
        return {
          googleId: info.sub,
          email: info.email.toLowerCase().trim(),
          emailVerified: Boolean(info.email_verified),
          firstName: info.given_name || info.name?.split(" ")[0] || "Valued",
          lastName: info.family_name || info.name?.split(" ").slice(1).join(" ") || "",
          picture: info.picture,
        };
      }
    }
  } catch {
    // Ignore
  }

  throw new UnauthorizedError("Invalid or expired Google authentication credential.");
}
