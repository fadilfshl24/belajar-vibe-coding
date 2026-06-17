import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Context } from "elysia";
import { failedResponse, successResponse } from "../utils/response";
import { parseLoginInput, parseRefreshTokenInput } from "../validations/authValidation";
import { UserModel } from "../models/UserModel";
import { SessionModel } from "../models/SessionModel";
import { OauthModel } from "../models/OauthModel";
import { logActivity } from "../utils/activityLogger";
import type { JwtPayload } from "../types/JwtPayload";

export class AuthController {
  // ---------------------------------------------------------------------------
  // POST /login
  // ---------------------------------------------------------------------------
  static async login(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      // Zod safeParse — validates and returns typed data
      const parsed = parseLoginInput(ctx.body);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        return failedResponse(
          correlationId,
          "Login failed!",
          400,
          firstError?.message ?? "Input data not found or invalid!"
        );
      }

      const { email, password } = parsed.data;

      // Look up user — use identical error messages for "not found" vs
      // "wrong password" to prevent user enumeration attacks.
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        return failedResponse(
          correlationId,
          "Data not found!",
          400,
          "Email or password is incorrect"
        );
      }

      // Check account is active
      if (user.status !== 1) {
        return failedResponse(
          correlationId,
          "Login failed!",
          400,
          "Your account is inactive"
        );
      }

      // Verify password — never log the plaintext or hash
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return failedResponse(
          correlationId,
          "Data not found!",
          400,
          "Email or password is incorrect"
        );
      }

      // Issue session in database
      const userAgent = ctx.headers["user-agent"];
      const ipAddress = (ctx.headers["x-forwarded-for"] as string | undefined) ?? (ctx.headers["x-real-ip"] as string | undefined) ?? "";
      
      const session = await SessionModel.createSession(user.id, userAgent, ipAddress);
      const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

      // Log activity
      await logActivity({
        userId: user.id,
        action: "LOGIN",
        description: `User ${user.name} berhasil masuk ke sistem`,
        ipAddress,
        userAgent,
      });

      return successResponse(correlationId, "Data found!", {
        record: {
          accessToken: session.id,
          refreshToken: session.id,
          tokenType: "Bearer",
          expiresIn,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /refresh-token
  // ---------------------------------------------------------------------------
  static async refreshToken(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      // Zod safeParse
      const parsed = parseRefreshTokenInput(ctx.body);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        return failedResponse(
          correlationId,
          "Refresh token failed!",
          400,
          firstError?.message ?? "Input data not found or invalid!"
        );
      }

      const { refreshToken } = parsed.data;

      // Verify refresh token using the dedicated secret
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET!
        ) as JwtPayload;
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : "Invalid token";
        return failedResponse(correlationId, "Token invalid.", 401, detail);
      }

      // Confirm user still exists and is active
      const user = await UserModel.findById(decoded.sub);
      if (!user || user.status !== 1) {
        return failedResponse(correlationId, "Token invalid.", 401);
      }

      // Issue a new access token — refresh token is NOT rotated here
      const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
      const newAccessToken = jwt.sign(
        { sub: decoded.sub, email: decoded.email } as JwtPayload,
        process.env.JWT_SECRET!,
        { expiresIn } as jwt.SignOptions
      );

      return successResponse(correlationId, "Data found!", {
        record: {
          accessToken: newAccessToken,
          tokenType: "Bearer",
          expiresIn,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /logout  (protected — requires valid Bearer access token)
  // ---------------------------------------------------------------------------
  static async logout(ctx: Context & { user?: JwtPayload; sessionId?: string; correlationId?: string }) {
    // correlationId, user, and sessionId are injected by authMiddleware via derive
    const correlationId =
      ctx.correlationId ??
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    if (ctx.sessionId) {
      await SessionModel.revokeSession(ctx.sessionId);
      
      // Log activity
      if (ctx.user) {
        const userAgent = ctx.headers["user-agent"];
        const ipAddress = (ctx.headers["x-forwarded-for"] as string | undefined) ?? (ctx.headers["x-real-ip"] as string | undefined) ?? "";
        await logActivity({
          userId: ctx.user.sub,
          action: "LOGOUT",
          description: `User ${ctx.user.email} keluar dari sistem`,
          ipAddress,
          userAgent,
        });
      }
    }

    return successResponse(correlationId, "Data has been deleted", null);
  }

  // ---------------------------------------------------------------------------
  // GET /oauth/:provider
  // ---------------------------------------------------------------------------
  static async oauthRedirect(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const provider = ctx.params.provider?.toLowerCase();

    if (!["google", "facebook", "gitlab", "github"].includes(provider)) {
      return failedResponse(correlationId, "Invalid provider", 400);
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const redirectUri = `${appUrl}/api/auth/oauth/${provider}/callback`;

    // Check if configuration is missing to decide whether to use mock flow
    const envPrefix = provider.toUpperCase();
    const clientId = process.env[`${envPrefix}_CLIENT_ID`];
    const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];

    if (!clientId || !clientSecret) {
      // Mock flow: redirect directly to callback with a mock code
      const mockCode = `mock_code_${provider}_${crypto.randomUUID()}`;
      ctx.set.redirect = `${redirectUri}?code=${mockCode}`;
      return;
    }

    // Real OAuth Redirect URLs
    let authUrl = "";
    if (provider === "google") {
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=email%20profile`;
    } else if (provider === "facebook") {
      authUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=email`;
    } else if (provider === "gitlab") {
      authUrl = `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=read_user`;
    } else if (provider === "github") {
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=read:user%20user:email`;
    }

    ctx.set.redirect = authUrl;
  }

  // ---------------------------------------------------------------------------
  // GET /oauth/:provider/callback
  // ---------------------------------------------------------------------------
  static async oauthCallback(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const provider = ctx.params.provider?.toLowerCase();
    
    // Elysia query params are accessed via ctx.query
    const { code } = ctx.query as { code?: string };

    if (!["google", "facebook", "gitlab", "github"].includes(provider)) {
      return failedResponse(correlationId, "Invalid provider", 400);
    }

    if (!code) {
      return failedResponse(correlationId, "Authorization code is missing", 400);
    }

    try {
      let email = "";
      let name = "";
      let providerUserId = "";
      let accessToken = "mock_access_token";

      // Check for mock flow
      if (code.startsWith("mock_code_")) {
        email = `mock_${provider}_user@example.com`;
        name = `Mock ${provider.charAt(0).toUpperCase() + provider.slice(1)} User`;
        providerUserId = `mock_id_${provider}_12345`;
      } else {
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        const redirectUri = `${appUrl}/api/auth/oauth/${provider}/callback`;
        const envPrefix = provider.toUpperCase();
        const clientId = process.env[`${envPrefix}_CLIENT_ID`];
        const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];

        if (!clientId || !clientSecret) {
          return failedResponse(correlationId, "OAuth client is not configured", 500);
        }

        // Real token exchange and profile fetch
        if (provider === "google") {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });
          const tokenData = (await tokenRes.json()) as any;
          if (!tokenData.access_token) {
            return failedResponse(correlationId, "Failed to exchange authorization code", 400, JSON.stringify(tokenData));
          }
          accessToken = tokenData.access_token;

          const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const profile = (await profileRes.json()) as any;
          email = profile.email;
          name = profile.name ?? profile.email.split("@")[0];
          providerUserId = profile.sub;
        } else if (provider === "facebook") {
          const tokenRes = await fetch(
            `https://graph.facebook.com/v12.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(
              redirectUri
            )}&client_secret=${clientSecret}&code=${code}`
          );
          const tokenData = (await tokenRes.json()) as any;
          if (!tokenData.access_token) {
            return failedResponse(correlationId, "Failed to exchange authorization code", 400, JSON.stringify(tokenData));
          }
          accessToken = tokenData.access_token;

          const profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
          const profile = (await profileRes.json()) as any;
          email = profile.email ?? `${profile.id}@facebook.com`;
          name = profile.name;
          providerUserId = profile.id;
        } else if (provider === "gitlab") {
          const tokenRes = await fetch("https://gitlab.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });
          const tokenData = (await tokenRes.json()) as any;
          if (!tokenData.access_token) {
            return failedResponse(correlationId, "Failed to exchange authorization code", 400, JSON.stringify(tokenData));
          }
          accessToken = tokenData.access_token;

          const profileRes = await fetch("https://gitlab.com/api/v4/user", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const profile = (await profileRes.json()) as any;
          email = profile.email;
          name = profile.name ?? profile.username;
          providerUserId = String(profile.id);
        } else if (provider === "github") {
          const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
            }),
          });
          const tokenData = (await tokenRes.json()) as any;
          if (!tokenData.access_token) {
            return failedResponse(correlationId, "Failed to exchange authorization code", 400, JSON.stringify(tokenData));
          }
          accessToken = tokenData.access_token;

          const profileRes = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "Elysia-OAuth-Client",
            },
          });
          const profile = (await profileRes.json()) as any;
          name = profile.name ?? profile.login;
          providerUserId = String(profile.id);

          // Get primary email
          if (profile.email) {
            email = profile.email;
          } else {
            const emailsRes = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "Elysia-OAuth-Client",
              },
            });
            const emails = (await emailsRes.json()) as any[];
            if (Array.isArray(emails)) {
              const primaryEmail = emails.find((e: any) => e.primary) ?? emails[0];
              email = primaryEmail?.email ?? "";
            }
          }
        }
      }

      if (!email || !providerUserId) {
        return failedResponse(correlationId, "Failed to retrieve user profile from OAuth provider", 400);
      }

      // Check if OAuth account mapping exists
      let oauthAccount = await OauthModel.findAccount(provider, providerUserId);
      let userId: string;
      let isNewUser = false;

      if (oauthAccount) {
        userId = oauthAccount.userId;
      } else {
        // Check if there is an existing user with the same email
        let user = await UserModel.findByEmail(email.toLowerCase().trim());
        if (!user) {
          // Create new user (Scenario C)
          user = await UserModel.createUser({
            name,
            email: email.toLowerCase().trim(),
            password: "", // Nullable password for OAuth accounts
          });
          isNewUser = true;
        }
        
        userId = user.id;

        // Link the OAuth account
        await OauthModel.linkAccount({
          userId,
          provider,
          providerUserId,
          providerEmail: email,
          accessToken,
        });
      }

      // Issue session
      const userAgent = ctx.headers["user-agent"];
      const ipAddress = (ctx.headers["x-forwarded-for"] as string | undefined) ?? (ctx.headers["x-real-ip"] as string | undefined) ?? "";
      
      const session = await SessionModel.createSession(userId, userAgent, ipAddress);
      const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

      // Log activity
      if (isNewUser) {
        await logActivity({
          userId,
          action: "REGISTER",
          description: `User ${name} berhasil mendaftar ke sistem via OAuth ${provider}`,
          ipAddress,
          userAgent,
        });
      }
      await logActivity({
        userId,
        action: "LOGIN",
        description: `User ${name} berhasil masuk ke sistem via OAuth ${provider}`,
        ipAddress,
        userAgent,
      });

      return successResponse(correlationId, "OAuth Authentication Successful!", {
        record: {
          accessToken: session.id,
          refreshToken: session.id,
          tokenType: "Bearer",
          expiresIn,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error during OAuth callback", 500, message);
    }
  }
}
