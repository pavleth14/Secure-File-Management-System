import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { backfillDuplicateLeadsFromExistingLeads } from '../src/services/duplicateLeadBackfillService.js';

dotenv.config();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const result = await backfillDuplicateLeadsFromExistingLeads({ dryRun });
  console.log(
    `[backfill-duplicate-leads] scanned=${result.scanned} created=${result.created} skipped=${result.skipped} dryRun=${result.dryRun}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[backfill-duplicate-leads] failed', err);
  process.exit(1);
});
