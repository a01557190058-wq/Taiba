/**
 * Shared behaviour for every public page: navigation, current year and the
 * editable school content that appears in the header/footer/contact blocks.
 */
import { api } from './api.js';
import { qs, qsa, initNav, setYear } from './ui.js';

initNav();
setYear();

export const schoolContentPromise = api('/api/school-content')
  .then((data) => {
    const content = data.content || {};

    qsa('[data-content-key]').forEach((node) => {
      const key = node.dataset.contentKey;
      if (key && typeof content[key] === 'string') node.textContent = content[key];
    });

    const phoneNode = qs('[data-contact="phone"]');
    if (phoneNode && content.contact_phone) {
      phoneNode.textContent = content.contact_phone;
      const digits = content.contact_phone.replace(/[^\d+]/g, '');
      if (digits.length >= 7) phoneNode.setAttribute('href', `tel:${digits}`);
    }

    const emailNode = qs('[data-contact="email"]');
    if (emailNode && content.contact_email) {
      emailNode.textContent = content.contact_email;
      emailNode.setAttribute('href', `mailto:${content.contact_email}`);
    }

    return data;
  })
  .catch(() => null);
