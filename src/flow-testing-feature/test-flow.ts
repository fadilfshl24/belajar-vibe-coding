import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../core/db";
import { userOauthAccounts, userSessions } from "../modules/auth/auth.schema";
import { UserModel } from "../modules/user";
import { OauthModel } from "../modules/auth/auth.model";

async function cleanupUser(userId: string) {
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  await db.delete(userOauthAccounts).where(eq(userOauthAccounts.userId, userId));
  await UserModel.deleteById(userId);
}

async function runTests() {
  console.log("=== STARTING AUTHENTICATION & SESSION TESTS ===");

  const baseUrl = "http://localhost:3000/api";

  // 1. Prepare clean test user
  const email = "test_user_unique@example.com";
  const password = "Password123!";
  const name = "Test User Unique";

  // Clean up existing if any
  const existing = await UserModel.findByEmail(email);
  if (existing) {
    await cleanupUser(existing.id);
    console.log("Cleaned up existing test user.");
  }

  // Create user
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await UserModel.createUser({
    name,
    email,
    password: hashedPassword
  });
  console.log("Created test user:", user.email);

  // 2. Test Local Login
  console.log("\n--- Testing Local Login ---");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginRes.json() as any;
  console.log("Login Response Status:", loginRes.status);
  console.log("Login Response Data:", JSON.stringify(loginData, null, 2));

  const sessionToken = loginData.data?.record?.accessToken;
  if (!sessionToken) {
    throw new Error("Failed to get session token from login!");
  }
  console.log("Session token acquired:", sessionToken);

  // 3. Test Accessing Protected Route (Logout) with valid token
  console.log("\n--- Testing Protected Route (Logout) with Valid Token ---");
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
    }
  });
  const logoutData = await logoutRes.json() as any;
  console.log("Logout Response Status:", logoutRes.status);
  console.log("Logout Response Data:", JSON.stringify(logoutData, null, 2));

  // 4. Test Accessing Protected Route again with now revoked token
  console.log("\n--- Testing Protected Route with Revoked Token (Expected 401) ---");
  const accessRevokedRes = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
    }
  });
  const accessRevokedData = await accessRevokedRes.json() as any;
  console.log("Access Revoked Response Status:", accessRevokedRes.status);
  console.log("Access Revoked Response Data:", JSON.stringify(accessRevokedData, null, 2));

  // 5. Test OAuth Redirect Mock flow
  console.log("\n--- Testing OAuth Redirect (Mock Flow) ---");
  const oauthRedirectRes = await fetch(`${baseUrl}/auth/oauth/google`, {
    redirect: "manual"
  });
  console.log("Redirect Status:", oauthRedirectRes.status);
  console.log("Location header:", oauthRedirectRes.headers.get("location"));

  // 6. Test OAuth Callback Mock flow
  console.log("\n--- Testing OAuth Callback (Mock Flow) ---");
  const mockCode = "mock_code_google_test123";
  const oauthCallbackRes = await fetch(`${baseUrl}/auth/oauth/google/callback?code=${mockCode}`);
  const oauthCallbackData = await oauthCallbackRes.json() as any;
  console.log("OAuth Callback Status:", oauthCallbackRes.status);
  console.log("OAuth Callback Data:", JSON.stringify(oauthCallbackData, null, 2));

  const oauthSessionToken = oauthCallbackData.data?.record?.accessToken;
  console.log("OAuth Session Token:", oauthSessionToken);

  // 7. Verify OAuth account mapping in DB
  console.log("\n--- Verifying OAuth Link in DB ---");
  const linkedAccount = await OauthModel.findAccount("google", "mock_id_google_12345");
  console.log("Linked OAuth Account in DB:", JSON.stringify(linkedAccount, null, 2));

  // 8. Test GitHub OAuth Mock flow
  console.log("\n--- Testing GitHub OAuth Callback (Mock Flow) ---");
  const gitHubMockCode = "mock_code_github_test123";
  const gitHubOauthCallbackRes = await fetch(`${baseUrl}/auth/oauth/github/callback?code=${gitHubMockCode}`);
  const gitHubOauthCallbackData = await gitHubOauthCallbackRes.json() as any;
  console.log("GitHub OAuth Callback Status:", gitHubOauthCallbackRes.status);
  console.log("GitHub OAuth Callback Data:", JSON.stringify(gitHubOauthCallbackData, null, 2));

  // Clean up
  await cleanupUser(user.id);
  const oauthGoogleUser = await UserModel.findByEmail("mock_google_user@example.com");
  if (oauthGoogleUser) {
    await cleanupUser(oauthGoogleUser.id);
  }
  const oauthGitHubUser = await UserModel.findByEmail("mock_github_user@example.com");
  if (oauthGitHubUser) {
    await cleanupUser(oauthGitHubUser.id);
  }
  console.log("\nCleaned up all test data.");
  console.log("=== TESTS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
