/**
 * About page: replaces the static objectives list with the editable
 * objectives stored in the database (one objective per line).
 */
import { schoolContentPromise } from './common.js';
import { qs, el } from './ui.js';

const objectivesList = qs('#objectives-list');

function renderObjectives(data) {
  if (!objectivesList || !data) return;

  const objectives = Array.isArray(data.objectives) ? data.objectives.filter(Boolean) : [];
  if (!objectives.length) return; // keep the static fallback text

  objectivesList.replaceChildren(...objectives.map((item) => el('li', { text: item })));
}

schoolContentPromise.then(renderObjectives);
