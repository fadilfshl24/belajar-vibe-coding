import { db } from "./index";
import { provinces, regencies, districts, villages } from "../../modules/region/region.schema";

const IBNUX_BASE_URL = "https://ibnux.github.io/data-indonesia";

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} - Status: ${res.status} ${res.statusText}`);
  return res.json();
}

async function seedRegions() {
  console.log("Starting Region Seeder (Using ibnux/data-indonesia)...");
  
  // 1. Provinces
  console.log("Fetching Provinces...");
  const provs: { id: string; nama: string }[] = await fetchJSON(`${IBNUX_BASE_URL}/provinsi.json`);
  const provsData = provs.map((p) => ({ id: p.id, name: p.nama }));
  console.log(`Inserting ${provsData.length} provinces...`);
  await db.insert(provinces).values(provsData).onConflictDoNothing();

  // 2. Regencies
  console.log("Fetching and Inserting Regencies...");
  const allRegencies: { id: string; id_prov: string; nama: string }[] = [];
  for (const prov of provs) {
    const data = await fetchJSON(`${IBNUX_BASE_URL}/kabupaten/${prov.id}.json`);
    for (const item of data) {
      allRegencies.push({ id: item.id, id_prov: prov.id, nama: item.nama });
    }
  }
  const regenciesData = allRegencies.map((r) => ({ id: r.id, provinceId: r.id_prov, name: r.nama }));
  console.log(`Inserting ${regenciesData.length} regencies...`);
  for (let i = 0; i < regenciesData.length; i += 1000) {
    await db.insert(regencies).values(regenciesData.slice(i, i + 1000)).onConflictDoNothing();
  }

  // 3. Districts
  console.log("Fetching and Inserting Districts...");
  const allDistricts: { id: string; id_kabupaten: string; nama: string }[] = [];
  let fetchedRegenciesCount = 0;
  for (const reg of allRegencies) {
    try {
      const data = await fetchJSON(`${IBNUX_BASE_URL}/kecamatan/${reg.id}.json`);
      for (const item of data) {
        allDistricts.push({ id: item.id, id_kabupaten: reg.id, nama: item.nama });
      }
    } catch (e) {
      console.error(`Failed to fetch districts for regency ${reg.id}`);
    }
    fetchedRegenciesCount++;
    if (fetchedRegenciesCount % 50 === 0) console.log(`Fetched districts for ${fetchedRegenciesCount}/${allRegencies.length} regencies...`);
  }
  const districtsData = allDistricts.map((d) => ({ id: d.id, regencyId: d.id_kabupaten, name: d.nama }));
  console.log(`Inserting ${districtsData.length} districts...`);
  for (let i = 0; i < districtsData.length; i += 1000) {
    await db.insert(districts).values(districtsData.slice(i, i + 1000)).onConflictDoNothing();
  }

  // 4. Villages
  console.log("Fetching and Inserting Villages (This will take a while)...");
  let fetchedDistrictsCount = 0;
  let totalVillagesInserted = 0;
  for (const dist of allDistricts) {
    try {
      const data: { id: string; nama: string }[] = await fetchJSON(`${IBNUX_BASE_URL}/kelurahan/${dist.id}.json`);
      const villagesData = data.map((v) => ({ id: v.id, districtId: dist.id, name: v.nama }));
      if (villagesData.length > 0) {
        await db.insert(villages).values(villagesData).onConflictDoNothing();
        totalVillagesInserted += villagesData.length;
      }
    } catch (e) {
      console.error(`Failed to fetch villages for district ${dist.id}`);
    }
    fetchedDistrictsCount++;
    if (fetchedDistrictsCount % 500 === 0) {
      console.log(`Fetched and inserted villages for ${fetchedDistrictsCount}/${allDistricts.length} districts... (Total villages so far: ${totalVillagesInserted})`);
    }
  }

  console.log(`Region Seeding Completed Successfully! Total Villages Inserted: ${totalVillagesInserted}`);
  process.exit(0);
}

seedRegions().catch((e) => {
  console.error(e);
  process.exit(1);
});
