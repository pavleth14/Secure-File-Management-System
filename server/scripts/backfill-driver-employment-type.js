/**
 * Set employmentType on existing drivers from isOwnerOperator (one-time).
 *   node scripts/backfill-driver-employment-type.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Driver } from '../src/models/Driver.js';
import { syncLegacyOwnerOperatorFlag } from '../src/utils/driverEmploymentType.js';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const drivers = await Driver.find().select('isOwnerOperator employmentType').lean();
  let updated = 0;
  for (const doc of drivers) {
    const expected = doc.isOwnerOperator ? 'Owner Operator' : 'Company Driver';
    if (doc.employmentType === expected) continue;
    await Driver.updateOne(
      { _id: doc._id },
      {
        $set: {
          employmentType: expected,
          isOwnerOperator: syncLegacyOwnerOperatorFlag(expected),
        },
      }
    );
    updated += 1;
  }
  console.log('Backfilled employmentType on', updated, 'of', drivers.length, 'drivers');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
