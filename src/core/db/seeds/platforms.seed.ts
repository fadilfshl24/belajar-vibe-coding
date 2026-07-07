import { db } from "../index";
import { platforms } from "../../../modules/platform/platform.schema";
import { eq } from "drizzle-orm";

/**
 * Seed: Platforms
 *
 * Membuat platform e-commerce default (Tiktok Shop, Lazada, Shopee, Tokopedia).
 * Bersifat idempotent — tidak akan insert duplikat jika sudah ada.
 */
export const PLATFORMS = [
  { code: "tiktok", name: "Tiktok Shop", isActive: true },
  { code: "lazada", name: "Lazada", isActive: true },
  { code: "shopee", name: "Shopee", isActive: true },
  { code: "tokopedia", name: "Tokopedia", isActive: true },
] as const;

export async function seedPlatforms(): Promise<Record<string, string>> {
  console.log("🏪 Seeding platforms...");
  const platformIdMap: Record<string, string> = {};

  for (const platform of PLATFORMS) {
    const existing = await db
      .select({ id: platforms.id })
      .from(platforms)
      .where(eq(platforms.code, platform.code))
      .limit(1);

    if (existing[0]) {
      platformIdMap[platform.code] = existing[0].id;
      console.log(`  ✓ Platform "${platform.name}" already exists`);
    } else {
      const inserted = await db.insert(platforms).values(platform).returning({ id: platforms.id });
      platformIdMap[platform.code] = inserted[0]!.id;
      console.log(`  + Platform "${platform.name}" created`);
    }
  }

  return platformIdMap;
}
