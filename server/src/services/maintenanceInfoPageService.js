import { MaintenanceInfoPage } from '../models/MaintenanceInfoPage.js';
import { assertValidMaintenanceInfoPageSlug } from '../config/maintenanceInfoPages.js';
import { sanitizeMaintenanceInfoHtml } from '../utils/maintenanceInfoHtml.js';
import { canEditMaintenanceInfoPages } from '../utils/maintenancePermissions.js';

function formatPage(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    slug: obj.slug,
    content: obj.content || '',
    updatedAt: obj.updatedAt,
    updatedByName: obj.updatedBy?.name || obj.updatedBy?.email || null,
  };
}

async function getOrCreatePage(slug) {
  let page = await MaintenanceInfoPage.findOne({ slug });
  if (!page) {
    page = await MaintenanceInfoPage.create({ slug, content: '' });
  }
  return page;
}

export async function getMaintenanceInfoPage(slug) {
  const validSlug = assertValidMaintenanceInfoPageSlug(slug);
  const page = await MaintenanceInfoPage.findOne({ slug: validSlug }).populate(
    'updatedBy',
    'name email'
  );
  if (!page) {
    return {
      slug: validSlug,
      content: '',
      updatedAt: null,
      updatedByName: null,
    };
  }
  return formatPage(page);
}

export async function updateMaintenanceInfoPage(slug, content, user) {
  if (!canEditMaintenanceInfoPages(user)) {
    const err = new Error('Only maintenance managers can edit info pages');
    err.status = 403;
    throw err;
  }
  const validSlug = assertValidMaintenanceInfoPageSlug(slug);
  const safeContent = sanitizeMaintenanceInfoHtml(content);
  const page = await getOrCreatePage(validSlug);
  page.content = safeContent;
  page.updatedBy = user._id;
  await page.save();
  await page.populate('updatedBy', 'name email');
  return formatPage(page);
}
