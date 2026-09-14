import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { backfillMissingHiredDates } from '../src/services/hiredDateBackfillService.js';

dotenv.config();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const result = await backfillMissingHiredDates({ dryRun });
  console.log(
    `[backfill-hired-dates] scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} dryRun=${result.dryRun}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[backfill-hired-dates] failed', err);
  process.exit(1);
});
