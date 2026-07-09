import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  try {
    await sql`ALTER TABLE "purchase_order_details" ADD COLUMN "quotation_plan_detail_id" uuid;`;
    console.log("Added quotation_plan_detail_id");
  } catch (e: any) {
    console.error("Error adding quotation_plan_detail_id:", e.message);
  }
  
  try {
    await sql`ALTER TABLE "purchase_orders" ADD COLUMN "quotation_plan_id" uuid;`;
    console.log("Added quotation_plan_id");
  } catch (e: any) {
    console.error("Error adding quotation_plan_id:", e.message);
  }
}

main().then(() => process.exit(0));
