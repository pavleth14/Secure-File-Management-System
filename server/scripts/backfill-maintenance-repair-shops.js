/**
 * Create repair shop catalog entries from existing case repairShop text and link cases.
 *   node scripts/backfill-maintenance-repair-shops.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { MaintenanceCase } from '../src/models/MaintenanceCase.js';
import { ensureMaintenanceRepairShop } from '../src/services/maintenanceRepairShopService.js';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const cases = await MaintenanceCase.find({
    repairShop: { $ne: '' },
    $or: [{ repairShopId: null }, { repairShopId: { $exists: false } }],
  }).select('repairShop createdBy');

  let linked = 0;
  for (const doc of cases) {
    const name = String(doc.repairShop || '').trim();
    if (!name) continue;
    const shop = await ensureMaintenanceRepairShop(name, doc.createdBy);
    await MaintenanceCase.updateOne(
      { _id: doc._id },
      { $set: { repairShopId: shop._id, repairShop: shop.name } }
    );
    linked += 1;
  }

  console.log('Linked', linked, 'cases to repair shop catalog');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});