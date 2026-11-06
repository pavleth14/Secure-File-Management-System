/**
 * Run once if MongoDB warns about duplicate VINs when creating sparse unique indexes
 * on Truck.vin / Trailer.vin. Fixes empty-string duplicates by setting vin to unset.
 *
 * Usage: node server/scripts/backfill-unique-vin-indexes.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const TruckSchema = new mongoose.Schema({}, { strict: false, collection: 'trucks' });
const TrailerSchema = new mongoose.Schema({}, { strict: false, collection: 'trailers' });
const Truck = mongoose.model('BackfillTruck', TruckSchema);
const Trailer = mongoose.model('BackfillTrailer', TrailerSchema);

async function clearEmptyVin(model, name) {
  const res = await model.updateMany(
    { $or: [{ vin: '' }, { vin: null }] },
    { $unset: { vin: '' } }
  );
  console.log(`${name}: cleared empty vin on ${res.modifiedCount} documents`);
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  await clearEmptyVin(Truck, 'Truck');
  await clearEmptyVin(Trailer, 'Trailer');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
