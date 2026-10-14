/**
 * Seed dispatch demo fleet + assignments + October 2026 loads (adds alongside existing data).
 *
 * Trucks 9001–9050, trailers T9001–T9050, drivers "Demo Driver ####".
 * Random driver/trailer pairing per truck; dispatcher Danilo (by email).
 *
 * Usage (from server/):
 *   node scripts/seed-dispatch-demo-oct2026.js
 *   node scripts/seed-dispatch-demo-oct2026.js --dry-run
 *
 * IMPORTANT: git push / deploy does NOT run this script. You must execute it on the machine
 * that can reach the same MongoDB as the live app (prod: SSH to API server, pull, then run).
 *
 * Env: MONGODB_URI (must match the DB your app uses); optional DISPATCH_SEED_DISPATCHER_EMAIL
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Truck } from '../src/models/Truck.js';
import { Trailer } from '../src/models/Trailer.js';
import { Driver } from '../src/models/Driver.js';
import { TruckAssignment } from '../src/models/TruckAssignment.js';
import { Load } from '../src/models/Load.js';
import { DispatchState } from '../src/models/DispatchState.js';
import { User } from '../src/models/User.js';
import { updateAssignment } from '../src/services/assignmentService.js';
import { parseChicagoDateTime } from '../src/utils/chicagoTime.js';

dotenv.config();

const SEED_COUNT = 50;
const SEED_TRUCK_START = 9001;
const SEED_TAG = 'dispatch-demo-oct2026';
const OCT_YEAR = 2026;
const OCT_MONTH = 10;

const CUSTOMERS = [
  'Midwest Freight Co',
  'Heartland Logistics',
  'Great Lakes Transport',
  'Prairie Line Inc',
  'River City Carriers',
  'Sunbelt Shipping',
  'Northern Star Freight',
  'Capitol Cargo LLC',
  'Blue Ridge Haulers',
  'Gateway Distribution',
];

const LANES = [
  { from: { city: 'Chicago', state: 'IL' }, to: { city: 'Detroit', state: 'MI' } },
  { from: { city: 'St. Louis', state: 'MO' }, to: { city: 'Memphis', state: 'TN' } },
  { from: { city: 'Dallas', state: 'TX' }, to: { city: 'Atlanta', state: 'GA' } },
  { from: { city: 'Indianapolis', state: 'IN' }, to: { city: 'Columbus', state: 'OH' } },
  { from: { city: 'Kansas City', state: 'MO' }, to: { city: 'Denver', state: 'CO' } },
  { from: { city: 'Nashville', state: 'TN' }, to: { city: 'Louisville', state: 'KY' } },
  { from: { city: 'Burr Ridge', state: 'IL' }, to: { city: 'Miami', state: 'FL' } },
  { from: { city: 'Phoenix', state: 'AZ' }, to: { city: 'Los Angeles', state: 'CA' } },
  { from: { city: 'Minneapolis', state: 'MN' }, to: { city: 'Milwaukee', state: 'WI' } },
  { from: { city: 'Houston', state: 'TX' }, to: { city: 'New Orleans', state: 'LA' } },
  { from: { city: 'Charlotte', state: 'NC' }, to: { city: 'Savannah', state: 'GA' } },
  { from: { city: 'Omaha', state: 'NE' }, to: { city: 'Des Moines', state: 'IA' } },
];

const dryRun = process.argv.includes('--dry-run');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function truckNumberForIndex(i) {
  return String(SEED_TRUCK_START + i);
}

function trailerNumberForIndex(i) {
  return `T${SEED_TRUCK_START + i}`;
}

function driverNameForIndex(i) {
  return `Demo Driver ${truckNumberForIndex(i)}`;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getNextLoadNumber() {
  const state = await DispatchState.findOneAndUpdate(
    { key: 'load_counter' },
    { $inc: { lastLoadNumber: 1 } },
    { upsert: true, new: true }
  );
  return state.lastLoadNumber;
}

function buildStop(dateKey, time, city, stateCode, addressPrefix) {
  return {
    order: 1,
    scheduledAt: parseChicagoDateTime(dateKey, time),
    address: `${addressPrefix} Industrial Blvd`,
    city,
    state: stateCode,
  };
}

function getLoadDateRange(load) {
  const dates = [
    ...(load.pickups || []).map((s) => s.scheduledAt),
    ...(load.deliveries || []).map((s) => s.scheduledAt),
  ]
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) return { start: null, end: null };
  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

function rangesOverlap(a, b) {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  return a.start <= b.end && b.start <= a.end;
}

function planLoadsForOctober() {
  const plans = [];
  let day = 1;
  const loadCount = randomInt(2, 6);

  for (let n = 0; n < loadCount && day <= 28; n += 1) {
    const pickupDay = Math.min(day + randomInt(0, 1), 28);
    const deliveryDay = Math.min(pickupDay + randomInt(1, 4), 31);
    const lane = pick(LANES);
    plans.push({
      pickupKey: `${OCT_YEAR}-${pad2(OCT_MONTH)}-${pad2(pickupDay)}`,
      pickupTime: `${pad2(randomInt(5, 14))}:00`,
      deliveryKey: `${OCT_YEAR}-${pad2(OCT_MONTH)}-${pad2(deliveryDay)}`,
      deliveryTime: `${pad2(randomInt(8, 20))}:00`,
      lane,
      loadedMiles: randomInt(180, 1200),
      emptyMiles: randomInt(0, 120),
      invoiceAmount: randomInt(850, 4200),
    });
    day = deliveryDay + randomInt(1, 3);
  }

  return plans;
}

function buildLoadDocs(truckId, trailerId, driverId, actorId, truckNum) {
  const plans = planLoadsForOctober();
  const created = [];
  const pendingRanges = [];

  for (let seq = 0; seq < plans.length; seq += 1) {
    const plan = plans[seq];
    const pickups = [
      buildStop(
        plan.pickupKey,
        plan.pickupTime,
        plan.lane.from.city,
        plan.lane.from.state,
        'Pickup'
      ),
    ];
    const deliveries = [
      buildStop(
        plan.deliveryKey,
        plan.deliveryTime,
        plan.lane.to.city,
        plan.lane.to.state,
        'Delivery'
      ),
    ];

    const draft = { pickups, deliveries };
    const range = getLoadDateRange(draft);
    if (pendingRanges.some((r) => rangesOverlap(r, range))) continue;
    pendingRanges.push(range);

    const deliveryDate = new Date(deliveries[0].scheduledAt);
    const refNow = new Date('2026-10-15T17:00:00.000Z');
    let status = 'open';
    let isActive = false;
    let deliveredAt = null;

    if (deliveryDate < refNow) {
      status = 'delivered';
      deliveredAt = deliveryDate;
    } else if (seq === plans.length - 1 && Math.random() > 0.45) {
      status = 'active';
      isActive = true;
    }

    created.push({
      customer: pick(CUSTOMERS),
      contact: `dispatch.demo+${truckNum}@example.com`,
      customerLoadNumber: `DEMO-OCT-${truckNum}-${seq + 1}`,
      invoiceAmount: plan.invoiceAmount,
      pickups,
      deliveries,
      truckId,
      trailerId,
      driverId,
      coDriverId: null,
      loadedMiles: plan.loadedMiles,
      emptyMiles: plan.emptyMiles,
      status,
      isActive,
      deliveredAt,
      archived: false,
      createdBy: actorId,
    });
  }

  return created;
}

async function ensureDemoDriversAndTrailers(actorId) {
  const drivers = [];
  const trailers = [];

  for (let i = 0; i < SEED_COUNT; i += 1) {
    const name = driverNameForIndex(i);
    let driver = await Driver.findOne({ name });
    if (!driver) {
      driver = await Driver.create({
        name,
        driverType: 'Solo',
        status: 'Active',
        phone: `555${String(SEED_TRUCK_START + i).padStart(7, '0').slice(-7)}`,
        notes: SEED_TAG,
        createdBy: actorId,
      });
    }
    drivers.push(driver);

    const trailerNumber = trailerNumberForIndex(i);
    let trailer = await Trailer.findOne({ trailerNumber });
    if (!trailer) {
      trailer = await Trailer.create({
        trailerNumber,
        type: pick(['Dry Van', 'Reefer', 'Flatbed']),
        status: 'Active',
        notes: SEED_TAG,
        createdBy: actorId,
      });
    }
    trailers.push(trailer);
  }

  return { drivers, trailers };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  const dispatcherEmail = (
    process.env.DISPATCH_SEED_DISPATCHER_EMAIL || 'danilo@twobrothersfreight.com'
  )
    .trim()
    .toLowerCase();

  const safeUri = uri.replace(/\/\/([^@/]+@)?/, '//');
  console.log(`[seed-dispatch-demo-oct2026] Connecting to MongoDB (${safeUri})…`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  } catch (connectErr) {
    console.error(
      '[seed-dispatch-demo-oct2026] Cannot connect to MongoDB. Start local Mongo or set MONGODB_URI to prod (on the API server).'
    );
    console.error(connectErr.message);
    process.exit(1);
  }

  const dispatcher = await User.findOne({ email: dispatcherEmail });
  if (!dispatcher) {
    console.error(`Dispatcher user not found: ${dispatcherEmail}`);
    process.exit(1);
  }
  if (!dispatcher.isDispatcher || !dispatcher.dispatchBoardId) {
    console.error(
      'Dispatcher must have isDispatcher and dispatchBoardId (assign Board in Users page)'
    );
    process.exit(1);
  }

  const summary = {
    trucksCreated: 0,
    assignmentsUpdated: 0,
    loadsCreated: 0,
    trucksSkippedExisting: 0,
  };

  const driverOrder = shuffle([...Array(SEED_COUNT).keys()]);
  const trailerOrder = shuffle([...Array(SEED_COUNT).keys()]);

  if (dryRun) {
    let wouldLoads = 0;
    for (let i = 0; i < SEED_COUNT; i += 1) {
      const exists = await Truck.findOne({ truckNumber: truckNumberForIndex(i) });
      if (exists) summary.trucksSkippedExisting += 1;
      else {
        summary.trucksCreated += 1;
        wouldLoads += planLoadsForOctober().length;
      }
    }
    summary.loadsCreated = wouldLoads;
    console.log(
      `[seed-dispatch-demo-oct2026] dryRun=true dispatcher=${dispatcher.email}`,
      summary
    );
    await mongoose.disconnect();
    return;
  }

  const { drivers, trailers } = await ensureDemoDriversAndTrailers(dispatcher._id);

  for (let i = 0; i < SEED_COUNT; i += 1) {
    const truckNum = truckNumberForIndex(i);
    if (await Truck.findOne({ truckNumber: truckNum })) {
      summary.trucksSkippedExisting += 1;
      continue;
    }

    const truck = await Truck.create({
      truckNumber: truckNum,
      type: 'Semi',
      status: 'Active',
      make: pick(['Freightliner', 'Kenworth', 'Volvo', 'Peterbilt']),
      model: 'Cascadia',
      year: String(randomInt(2018, 2024)),
      notes: SEED_TAG,
      createdBy: dispatcher._id,
    });

    await TruckAssignment.create({ truckId: truck._id, history: [] });

    const driver = drivers[driverOrder[i]];
    const trailer = trailers[trailerOrder[i]];

    await updateAssignment(
      truck._id,
      { driverId: driver._id, dispatcherId: dispatcher._id },
      dispatcher._id
    );
    summary.assignmentsUpdated += 1;

    const loadDocs = buildLoadDocs(
      truck._id,
      trailer._id,
      driver._id,
      dispatcher._id,
      truckNum
    );

    for (const doc of loadDocs) {
      const loadNumber = await getNextLoadNumber();
      await Load.create({ loadNumber, ...doc });
      summary.loadsCreated += 1;
    }

    summary.trucksCreated += 1;
  }

  console.log(
    `[seed-dispatch-demo-oct2026] dryRun=false dispatcher=${dispatcher.email} dispatchBoardId=${dispatcher.dispatchBoardId}`,
    summary
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed-dispatch-demo-oct2026] failed', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
