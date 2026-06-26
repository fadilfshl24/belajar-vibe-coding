import bcrypt from "bcryptjs";
import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { parseLoginInput, parseRefreshTokenInput } from "./auth.validation";
import { SessionModel, OauthModel } from "./auth.model";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { UserModel } from "../user";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { db } from "../../core/db";
import { roles, userWarehouseRoles } from "../role/role.schema";
import { menus } from "../menu/menu.schema";
import { roleMenuPermissions } from "../permission/permission.schema";

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
        return failedResponse(correlationId, "Data not found!", 400, "Your account is not found");
      }

      if (user.status !== 1) {
        return failedResponse(correlationId, "Login failed!", 400, "Your account is inactive");
      }

      // bcrypt compare — password bisa null untuk akun OAuth-only
      const passwordMatch = user.password
        ? await bcrypt.compare(password, user.password)
        : false;
      if (!passwordMatch) {
        return failedResponse(correlationId, "Data not found!", 400, "Password is incorrect");
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
        module: "AUTH",
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
      console.log(err);

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
          module: "AUTH",
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
        await logActivity({ userId, action: "REGISTER", module: "AUTH", description: `User ${name} berhasil mendaftar ke sistem via OAuth ${provider}`, ipAddress, userAgent });
      }
      await logActivity({ userId, action: "LOGIN", module: "AUTH", description: `User ${name} berhasil masuk ke sistem via OAuth ${provider}`, ipAddress, userAgent });

      return successResponse(correlationId, "OAuth Authentication Successful!", {
        record: { accessToken: session.id, refreshToken: session.id, tokenType: "Bearer", expiresIn },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error during OAuth callback", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /api/auth/me (protected)
  // ---------------------------------------------------------------------------
  static async getMe(
    ctx: Context & { user?: JwtPayload; correlationId?: string }
  ) {
    const correlationId =
      ctx.correlationId ??
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    if (!ctx.user) {
      return failedResponse(correlationId, "Unauthorized", 401, "User session not found");
    }

    try {
      const userId = ctx.user.sub;

      const user = await UserModel.findById(userId);
      if (!user) {
        return failedResponse(correlationId, "User not found", 404);
      }

      if (user.status !== 1) {
        return failedResponse(correlationId, "User account is inactive", 400);
      }

      // Fetch user roles
      const userRoles = await db
        .select({
          roleId: userWarehouseRoles.roleId,
          warehouseId: userWarehouseRoles.warehouseId,
          roleName: roles.name,
        })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(
          and(
            eq(userWarehouseRoles.userId, userId),
            isNull(userWarehouseRoles.deletedAt),
            isNull(roles.deletedAt)
          )
        );

      const roleIds = userRoles.map((ur) => ur.roleId);

      let permissionsList: any[] = [];
      if (roleIds.length > 0) {
        permissionsList = await db
          .select({
            menuId: roleMenuPermissions.menuId,
            menuCode: menus.code,
            menuName: menus.name,
            menuPath: menus.path,
            menuParentId: menus.parentId,
            menuSortOrder: menus.sortOrder,
            canView: roleMenuPermissions.canView,
            canCreate: roleMenuPermissions.canCreate,
            canUpdate: roleMenuPermissions.canUpdate,
            canDelete: roleMenuPermissions.canDelete,
          })
          .from(roleMenuPermissions)
          .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
          .where(
            and(
              inArray(roleMenuPermissions.roleId, roleIds),
              isNull(roleMenuPermissions.deletedAt),
              isNull(menus.deletedAt)
            )
          );
      }

      // Merge permissions from multiple roles
      const mergedPermissions: Record<string, {
        menuCode: string;
        canView: boolean;
        canCreate: boolean;
        canUpdate: boolean;
        canDelete: boolean;
      }> = {};

      for (const p of permissionsList) {
        const existing = mergedPermissions[p.menuCode];
        if (!existing) {
          mergedPermissions[p.menuCode] = {
            menuCode: p.menuCode,
            canView: p.canView,
            canCreate: p.canCreate,
            canUpdate: p.canUpdate,
            canDelete: p.canDelete,
          };
        } else {
          existing.canView = existing.canView || p.canView;
          existing.canCreate = existing.canCreate || p.canCreate;
          existing.canUpdate = existing.canUpdate || p.canUpdate;
          existing.canDelete = existing.canDelete || p.canDelete;
        }
      }

      // Fetch all menus to build the full tree
      const allMenus = await db
        .select()
        .from(menus)
        .where(and(eq(menus.isActive, true), isNull(menus.deletedAt)))
        .orderBy(asc(menus.sortOrder));

      interface MenuItem {
        id: string;
        parentId: string | null;
        name: string;
        code: string;
        path: string;
        sortOrder: number;
        icon: string | null;
        isActive: boolean;
        children: MenuItem[];
      }

      const menuMap = new Map<string, MenuItem>();
      const allMenuItems: MenuItem[] = allMenus.map((m) => ({
        id: m.id,
        parentId: m.parentId,
        name: m.name,
        code: m.code,
        path: m.path,
        sortOrder: m.sortOrder,
        icon: m.icon,
        isActive: m.isActive,
        children: [],
      }));

      allMenuItems.forEach((item) => menuMap.set(item.id, item));

      // Find viewable menus
      const viewableIds = new Set<string>();

      // Step 1: Mark leaf nodes that the user can view
      for (const item of allMenuItems) {
        if (mergedPermissions[item.code]?.canView) {
          viewableIds.add(item.id);
        }
      }

      // Step 2: Bubble up viewable status to parent menus
      let addedAny = true;
      while (addedAny) {
        addedAny = false;
        for (const item of allMenuItems) {
          if (viewableIds.has(item.id) && item.parentId && !viewableIds.has(item.parentId)) {
            viewableIds.add(item.parentId);
            addedAny = true;
          }
        }
      }

      // Step 3: Build the tree with only viewable items
      const rootMenus: MenuItem[] = [];
      for (const item of allMenuItems) {
        if (!viewableIds.has(item.id)) continue;

        if (item.parentId) {
          const parent = menuMap.get(item.parentId);
          if (parent && viewableIds.has(parent.id)) {
            parent.children.push(item);
          }
        } else {
          rootMenus.push(item);
        }
      }

      // Step 4: Sort root menus and their children by sortOrder
      const sortFn = (a: MenuItem, b: MenuItem) => a.sortOrder - b.sortOrder;
      rootMenus.sort(sortFn);
      for (const item of allMenuItems) {
        item.children.sort(sortFn);
      }

      return successResponse(correlationId, "User details fetched successfully", {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          roles: userRoles.map((ur) => ur.roleName),
          permissions: Object.values(mergedPermissions),
          menus: rootMenus,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }
}
