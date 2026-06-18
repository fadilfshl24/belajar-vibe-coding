import bcrypt from "bcryptjs";
import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { parseLoginInput, parseRefreshTokenInput } from "./auth.validation";
import { SessionModel, OauthModel } from "./auth.model";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { UserModel } from "../user";

export class AuthController {
  // ---------------------------------------------------------------------------
  // POST /api/auth/login
  // ---------------------------------------------------------------------------
  static async login(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseLoginInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Login failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input data not found or invalid!"
        );
      }

      const { email, password } = parsed.data;

      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        return failedResponse(correlationId, "Data not found!", 400, "Email or password is incorrect");
      }

      if (user.status !== 1) {
        return failedResponse(correlationId, "Login failed!", 400, "Your account is inactive");
      }

      // bcrypt compare — password bisa null untuk akun OAuth-only
      const passwordMatch = user.password
        ? await bcrypt.compare(password, user.password)
        : false;
      if (!passwordMatch) {
        return failedResponse(correlationId, "Data not found!", 400, "Email or password is incorrect");
      }

      const userAgent = ctx.headers["user-agent"];
      const ipAddress =
        (ctx.headers["x-forwarded-for"] as string | undefined) ??
        (ctx.headers["x-real-ip"] as string | undefined) ??
        "";

      const session = await SessionModel.createSession(user.id, userAgent, ipAddress);
      const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

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
  // POST /api/auth/refresh-token
  // ---------------------------------------------------------------------------
  static async refreshToken(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseRefreshTokenInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Refresh token failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input data not found or invalid!"
        );
      }

      const { refreshToken } = parsed.data;

      // Untuk session-based auth, refresh token = session token
      const session = await SessionModel.validateSession(refreshToken);
      if (!session) {
        return failedResponse(correlationId, "Token invalid.", 401);
      }

      const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

      return successResponse(correlationId, "Data found!", {
        record: {
          accessToken: session.id,
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
  // POST /api/auth/logout  (protected)
  // ---------------------------------------------------------------------------
  static async logout(
    ctx: Context & { user?: JwtPayload; sessionId?: string; correlationId?: string }
  ) {
    const correlationId =
      ctx.correlationId ??
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    if (ctx.sessionId) {
      await SessionModel.revokeSession(ctx.sessionId);

      if (ctx.user) {
        const userAgent = ctx.headers["user-agent"];
        const ipAddress =
          (ctx.headers["x-forwarded-for"] as string | undefined) ??
          (ctx.headers["x-real-ip"] as string | undefined) ??
          "";

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
  // GET /api/auth/oauth/:provider
  // ---------------------------------------------------------------------------
  static async oauthRedirect(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const provider = (ctx.params.provider?.toLowerCase()) ?? "";

    if (!provider || !["google", "facebook", "gitlab", "github"].includes(provider)) {
      return failedResponse(correlationId, "Invalid provider", 400);
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const redirectUri = `${appUrl}/api/auth/oauth/${provider}/callback`;
    const envPrefix = provider.toUpperCase();
    const clientId = process.env[`${envPrefix}_CLIENT_ID`];
    const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];

    if (!clientId || !clientSecret) {
      const mockCode = `mock_code_${provider}_${crypto.randomUUID()}`;
      ctx.set.redirect = `${redirectUri}?code=${mockCode}`;
      return;
    }

    let authUrl = "";
    if (provider === "google") {
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`;
    } else if (provider === "facebook") {
      authUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email`;
    } else if (provider === "gitlab") {
      authUrl = `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read_user`;
    } else if (provider === "github") {
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email`;
    }

    ctx.set.redirect = authUrl;
  }

  // ---------------------------------------------------------------------------
  // GET /api/auth/oauth/:provider/callback
  // ---------------------------------------------------------------------------
  static async oauthCallback(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const provider = (ctx.params.provider?.toLowerCase()) ?? "";
    const { code } = ctx.query as { code?: string };

    if (!provider || !["google", "facebook", "gitlab", "github"].includes(provider)) {
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

        if (provider === "google") {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
          });
          const tokenData = (await tokenRes.json()) as any;
          if (!tokenData.access_token) return failedResponse(correlationId, "Failed to exchange authorization code", 400, JSON.stringify(tokenData));
          accessToken = tokenData.access_token;
          const profile = (await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } })).json()) as any;
          email = profile.email;
          name = profile.name ?? profile.email.split("@")[0];
          providerUserId = profile.sub;
        } else if (provider === "github") {
          const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
          });
          const tokenData = (await tokenRes.json()) as any;
          if (!tokenData.access_token) return failedResponse(correlationId, "Failed to exchange authorization code", 400, JSON.stringify(tokenData));
          accessToken = tokenData.access_token;
          const profile = (await (await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "WMS-OAuth-Client" } })).json()) as any;
          name = profile.name ?? profile.login;
          providerUserId = String(profile.id);
          email = profile.email ?? "";
          if (!email) {
            const emails = (await (await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "WMS-OAuth-Client" } })).json()) as any[];
            if (Array.isArray(emails)) email = (emails.find((e: any) => e.primary) ?? emails[0])?.email ?? "";
          }
        }
      }

      if (!email || !providerUserId) {
        return failedResponse(correlationId, "Failed to retrieve user profile from OAuth provider", 400);
      }

      let oauthAccount = await OauthModel.findAccount(provider, providerUserId);
      let userId: string;
      let isNewUser = false;

      if (oauthAccount) {
        userId = oauthAccount.userId;
      } else {
        let user = await UserModel.findByEmail(email.toLowerCase().trim());
        if (!user) {
          user = await UserModel.createUser({ name, email: email.toLowerCase().trim(), password: "" });
          isNewUser = true;
        }
        userId = user.id;
        await OauthModel.linkAccount({ userId, provider, providerUserId, providerEmail: email, accessToken });
      }

      const userAgent = ctx.headers["user-agent"];
      const ipAddress =
        (ctx.headers["x-forwarded-for"] as string | undefined) ??
        (ctx.headers["x-real-ip"] as string | undefined) ??
        "";

      const session = await SessionModel.createSession(userId, userAgent, ipAddress);
      const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

      if (isNewUser) {
        await logActivity({ userId, action: "REGISTER", description: `User ${name} berhasil mendaftar ke sistem via OAuth ${provider}`, ipAddress, userAgent });
      }
      await logActivity({ userId, action: "LOGIN", description: `User ${name} berhasil masuk ke sistem via OAuth ${provider}`, ipAddress, userAgent });

      return successResponse(correlationId, "OAuth Authentication Successful!", {
        record: { accessToken: session.id, refreshToken: session.id, tokenType: "Bearer", expiresIn },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error during OAuth callback", 500, message);
    }
  }
}
