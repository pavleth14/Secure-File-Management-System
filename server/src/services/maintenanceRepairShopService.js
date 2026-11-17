import { MaintenanceRepairShop } from '../models/MaintenanceRepairShop.js';
import { MaintenanceCase } from '../models/MaintenanceCase.js';
import {
  buildAutoMapsSearchUrl,
  normalizeMapsUrlInput,
  resolveRepairShopMapsUrl,
} from '../utils/repairShopMaps.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeName(name) {
  return String(name || '').trim();
}

export function formatRepairShopRecord(shop) {
  const obj = shop.toObject ? shop.toObject() : shop;
  return {
    id: obj._id.toString(),
    name: obj.name,
    mapsUrl: obj.mapsUrl || '',
    mapsLink: resolveRepairShopMapsUrl(obj),
    address: obj.address || '',
    city: obj.city || '',
    state: obj.state || '',
    zip: obj.zip || '',
    isActive: Boolean(obj.isActive),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export async function listMaintenanceRepairShops({ activeOnly = false, includeInactive = false } = {}) {
  const filter = {};
  if (!includeInactive || activeOnly) {
    filter.isActive = true;
  }
  const shops = await MaintenanceRepairShop.find(filter).sort({ name: 1 });
  return shops.map(formatRepairShopRecord);
}

export async function findRepairShopByNameInsensitive(name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  return MaintenanceRepairShop.findOne({
    name: new RegExp(`^${escapeRegex(normalized)}$`, 'i'),
  });
}

export async function ensureMaintenanceRepairShop(name, userId) {
  const normalized = normalizeName(name);
  if (!normalized) {
    const err = new Error('Repair shop name is required');
    err.status = 400;
    throw err;
  }

  let shop = await findRepairShopByNameInsensitive(normalized);
  if (shop) {
    if (!shop.isActive) {
      shop.isActive = true;
      await shop.save();
    }
    return shop;
  }

  shop = await MaintenanceRepairShop.create({
    name: normalized,
    mapsUrl: buildAutoMapsSearchUrl({ name: normalized }),
    isActive: true,
    createdBy: userId || null,
  });
  return shop;
}

export async function createMaintenanceRepairShop(payload, userId) {
  const name = normalizeName(payload.name);
  if (!name) {
    const err = new Error('Repair shop name is required');
    err.status = 400;
    throw err;
  }
  const existing = await findRepairShopByNameInsensitive(name);
  if (existing) {
    const err = new Error('A repair shop with this name already exists');
    err.status = 409;
    throw err;
  }

  const shop = await MaintenanceRepairShop.create({
    name,
    address: String(payload.address || '').trim(),
    city: String(payload.city || '').trim(),
    state: String(payload.state || '').trim(),
    zip: String(payload.zip || '').trim(),
    mapsUrl: buildAutoMapsSearchUrl({
      name,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
    }),
    isActive: true,
    createdBy: userId || null,
  });
  return formatRepairShopRecord(shop);
}

export async function updateMaintenanceRepairShop(id, payload) {
  const shop = await MaintenanceRepairShop.findById(id);
  if (!shop) {
    const err = new Error('Repair shop not found');
    err.status = 404;
    throw err;
  }

  if (payload.name !== undefined) {
    const name = normalizeName(payload.name);
    if (!name) {
      const err = new Error('Repair shop name is required');
      err.status = 400;
      throw err;
    }
    const duplicate = await MaintenanceRepairShop.findOne({
      _id: { $ne: shop._id },
      name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    });
    if (duplicate) {
      const err = new Error('A repair shop with this name already exists');
      err.status = 409;
      throw err;
    }
    shop.name = name;
  }

  if (payload.address !== undefined) shop.address = String(payload.address || '').trim();
  if (payload.city !== undefined) shop.city = String(payload.city || '').trim();
  if (payload.state !== undefined) shop.state = String(payload.state || '').trim();
  if (payload.zip !== undefined) shop.zip = String(payload.zip || '').trim();

  if (payload.regenerateMapsUrl === true) {
    shop.mapsUrl = buildAutoMapsSearchUrl(shop);
  } else if (payload.mapsUrl !== undefined) {
    const trimmed = String(payload.mapsUrl || '').trim();
    shop.mapsUrl = trimmed
      ? normalizeMapsUrlInput(trimmed)
      : buildAutoMapsSearchUrl(shop);
  }

  if (payload.isActive !== undefined) {
    shop.isActive = Boolean(payload.isActive);
  }

  await shop.save();

  if (payload.name !== undefined) {
    await MaintenanceCase.updateMany(
      { repairShopId: shop._id },
      { $set: { repairShop: shop.name } }
    );
  }

  return formatRepairShopRecord(shop);
}

export async function getMaintenanceRepairShopUsage(shopId) {
  const shop = await MaintenanceRepairShop.findById(shopId);
  if (!shop) {
    const err = new Error('Repair shop not found');
    err.status = 404;
    throw err;
  }
  const count = await MaintenanceCase.countDocuments({ repairShopId: shop._id });
  return { shop: formatRepairShopRecord(shop), count };
}

export async function deactivateMaintenanceRepairShop(shopId) {
  return updateMaintenanceRepairShop(shopId, { isActive: false });
}