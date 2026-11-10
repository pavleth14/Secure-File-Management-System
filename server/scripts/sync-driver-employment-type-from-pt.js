/**
 * Set isOwnerOperator from PT file Type column (TRUE=company, FALSE=OO).
 * Matches drivers by normalized CDL# then phone digits.
 *
 *   node scripts/sync-driver-employment-type-from-pt.js "path/to/PT Active Driver List (1).xlsx"
 */
import 'dotenv/config';
import XLSX from 'xlsx';
import path from 'path';
import mongoose from 'mongoose';
import { Driver } from '../src/models/Driver.js';

const defaultPath =
  'C:/Users/Administrator/Downloads/PT Active Driver List 11-10-2026 (1).xlsx';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCdl(value) {
  return String(value || '').trim().toUpperCase();
}

function employmentFromType(raw) {
  if (raw === true) return false;
  if (raw === false) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'true') return false;
  if (s === 'false') return true;
  return null;
}

async function main() {
  const filePath = path.resolve(process.argv[2] || defaultPath);
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI in .env');
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(
    wb.Sheets[wb.SheetNames[0]],
    { defval: '' }
  );

  const byCdl = new Map();
  const byPhone = new Map();
  for (const row of rows) {
    const isOo = employmentFromType(row.Type);
    if (isOo === null) continue;
    const cdl = normalizeCdl(row['CDL#'] || row['CDL Number']);
    const phone = normalizePhone(row['Phone#'] || row['Cell-Phone']);
    if (cdl) byCdl.set(cdl, isOo);
    if (phone.length >= 7) byPhone.set(phone, isOo);
  }

  await mongoose.connect(uri);
  const drivers = await Driver.find().select('name cdlNumber phone isOwnerOperator').lean();

  let updated = 0;
  let unmatched = 0;
  for (const doc of drivers) {
    const cdl = normalizeCdl(doc.cdlNumber);
    const phone = normalizePhone(doc.phone);
    let isOo = cdl && byCdl.has(cdl) ? byCdl.get(cdl) : undefined;
    if (isOo === undefined && phone.length >= 7 && byPhone.has(phone)) {
      isOo = byPhone.get(phone);
    }
    if (isOo === undefined) {
      unmatched += 1;
      continue;
    }
    if (Boolean(doc.isOwnerOperator) !== Boolean(isOo)) {
      await Driver.updateOne({ _id: doc._id }, { $set: { isOwnerOperator: isOo } });
      updated += 1;
    }
  }

  console.log('Updated:', updated, 'Unmatched in DB:', unmatched, 'PT rows:', rows.length);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
