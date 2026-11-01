/**
 * Admission page: renders the editable admission steps from the API.
 * Static fallback steps stay in the HTML until the request resolves.
 */
import { schoolContentPromise } from './common.js';
import { qs, el } from './ui.js';

const stepsList = qs('#admission-steps');
const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

function renderSteps(data) {
  if (!stepsList || !data) return;

  const steps = Array.isArray(data.admission_steps) ? data.admission_steps.filter(Boolean) : [];
  if (!steps.length) return; // keep the static fallback

  stepsList.replaceChildren(
    ...steps.slice(0, 8).map((text, index) =>
      el('li', { className: 'step' }, [
        el('h3', { text: `الخطوة ${ORDINALS[index] || index + 1}` }),
        el('p', { text }),
      ])
    )
  );
}

schoolContentPromise.then(renderSteps);
