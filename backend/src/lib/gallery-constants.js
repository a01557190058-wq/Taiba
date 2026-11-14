'use strict';

/**
 * Shared gallery constants. Kept in one place so the API validators, the
 * service and the admin UI all enforce the same limits and icon set.
 */
const GALLERY_ICONS = [
  'image',
  'book',
  'flask',
  'grid',
  'layers',
  'sparkles',
  'target',
  'users',
  'graduation',
  'star',
  'chart',
  'shield',
  'briefcase',
  'calendar',
  'quote',
  'video',
  'news',
  'file',
  'database',
  'search',
  'eye',
  'check',
  'info',
];

const GALLERY_LIMITS = {
  sections: 8,
  imagesPerSection: 40,
};

module.exports = { GALLERY_ICONS, GALLERY_LIMITS };
