/**
 * Shared behaviour for every public page: navigation, current year and the
 * editable school content that appears in the header/footer/contact blocks.
 */
import { api } from './api.js';
import { qsa, initNav, initMotion, setYear } from './ui.js';

initNav();
initMotion();
setYear();

export const schoolContentPromise = api('/api/school-content')
  .then((data) => {
    const content = data.content || {};

    qsa('[data-content-key]').forEach((node) => {
      const key = node.dataset.contentKey;
      if (key && typeof content[key] === 'string') node.textContent = content[key];
    });

    qsa('[data-contact="phone"]').forEach((phoneNode) => {
      if (!content.contact_phone) return;
      phoneNode.textContent = content.contact_phone;
      const digits = content.contact_phone.replace(/[^\d+]/g, '');
      if (digits.length >= 7) phoneNode.setAttribute('href', `tel:${digits}`);
    });

    qsa('[data-contact="email"]').forEach((emailNode) => {
      if (!content.contact_email) return;
      emailNode.textContent = content.contact_email;
      emailNode.setAttribute('href', `mailto:${content.contact_email}`);
    });

    return data;
  })
  .catch(() => null);
