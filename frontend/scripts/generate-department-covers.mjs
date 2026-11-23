import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates one distinct SVG cover per real vocational specialisation.
 * Only the school's palette is used: navy/blue, red, yellow and white.
 * Run with: node scripts/generate-department-covers.mjs
 */

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/assets/img/departments');
mkdirSync(outDir, { recursive: true });

const C = {
  navy: '#062B4D',
  blue: '#1769AA',
  blueBright: '#2E86D1',
  red: '#D62839',
  yellow: '#FFC928',
  white: '#FFFFFF',
};

const strokes = (body, color) => `
  <g transform="translate(320 210)" fill="none" stroke="${color}"
     stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>`;

const covers = [
  {
    slug: 'metal-lathe-technician',
    label: 'ورشة خراطة المعادن',
    from: C.navy, to: C.blueBright, accent: C.yellow, pattern: 'grid',
    icon: `
      <path d="M-120 -54 H-50 M-120 54 H-50" />
      <rect x="-56" y="-76" width="112" height="152" rx="16" />
      <circle cx="0" cy="0" r="38" />
      <circle cx="0" cy="0" r="12" />
      <path d="M56 0 H124 M92 -22 V22" />
      <path d="M-96 -78 L-70 -54 M-96 78 L-70 54" stroke-width="7" opacity="0.75" />`,
  },
  {
    slug: 'metal-welding-technician',
    label: 'ورشة لحام المعادن',
    from: '#3B0E18', to: C.red, accent: C.yellow, pattern: 'dots',
    icon: `
      <path d="M-118 -86 L-34 -10 M-92 -102 L-8 -26" />
      <rect x="-24" y="-38" width="56" height="30" rx="10" transform="rotate(38 4 -23)" />
      <path d="M30 22 L74 74" />
      <path d="M74 74 L60 48 L90 52 L70 26" fill="${C.yellow}" stroke="none" />
      <path d="M-120 92 H120" stroke-width="6" opacity="0.5" />
      <circle cx="104" cy="-68" r="5" fill="${C.yellow}" stroke="none" />
      <circle cx="118" cy="-36" r="4" fill="${C.yellow}" stroke="none" />`,
  },
  {
    slug: 'aluminium-technician',
    label: 'ورشة الألومتال',
    from: C.blue, to: '#52708F', accent: C.white, pattern: 'lines',
    icon: `
      <rect x="-110" y="-78" width="220" height="156" rx="10" />
      <path d="M0 -78 V78 M-110 0 H110" />
      <rect x="-86" y="-54" width="64" height="108" rx="4" />
      <rect x="22" y="-54" width="64" height="108" rx="4" />
      <path d="M-54 -54 V54 M54 -54 V54" stroke-width="6" opacity="0.7" />
      <circle cx="-16" cy="0" r="6" fill="${C.yellow}" stroke="none" />
      <circle cx="16" cy="0" r="6" fill="${C.yellow}" stroke="none" />`,
  },
  {
    slug: 'refrigeration-hvac-technician',
    label: 'التبريد والتكييف',
    from: '#0A3B66', to: C.blueBright, accent: C.white, pattern: 'dots',
    icon: `
      <circle cx="0" cy="0" r="82" />
      <circle cx="0" cy="0" r="16" />
      <path d="M0 -82 V-26 M0 26 V82 M-71 -41 L-22 -13 M22 13 L71 41 M-71 41 L-22 13 M22 -13 L71 -41" />
      <path d="M-108 -96 L-70 -96 M-108 -80 L-86 -80" stroke="${C.yellow}" stroke-width="7" />`,
  },
  {
    slug: 'computer-networks-technician',
    label: 'شبكات الحاسب',
    from: C.navy, to: C.blue, accent: C.yellow, pattern: 'grid',
    icon: `
      <rect x="-104" y="-72" width="208" height="124" rx="14" />
      <path d="M-40 76 H40 M0 52 V76" />
      <path d="M0 -72 V-16" stroke="${C.yellow}" />
      <circle cx="0" cy="-104" r="16" stroke="${C.yellow}" />
      <path d="M0 -88 L-64 -30 M0 -88 L64 -30" stroke="${C.yellow}" />
      <circle cx="-76" cy="-18" r="12" />
      <circle cx="76" cy="-18" r="12" />`,
  },
  {
    slug: 'industrial-plumbing-technician',
    label: 'المواسير الصناعية',
    from: '#0A3B66', to: '#3E7E9C', accent: C.yellow, pattern: 'lines',
    icon: `
      <path d="M-116 -64 H-30 V0 H54 V64 H116" />
      <path d="M-116 -36 H-58 V28 H26 V92 H82" opacity="0.55" stroke-width="8" />
      <circle cx="-30" cy="-64" r="12" fill="${C.yellow}" stroke="none" />
      <circle cx="54" cy="0" r="12" fill="${C.yellow}" stroke="none" />
      <path d="M-16 92 C-16 66 16 50 16 24 C16 50 48 66 48 92 C48 110 -16 110 -16 92Z" fill="${C.yellow}" stroke="none" />`,
  },
  {
    slug: 'home-appliances-technician',
    label: 'صيانة الأجهزة المنزلية',
    from: C.blue, to: C.navy, accent: C.red, pattern: 'dots',
    icon: `
      <rect x="-92" y="-104" width="184" height="208" rx="20" />
      <circle cx="0" cy="18" r="58" />
      <circle cx="0" cy="18" r="36" opacity="0.55" />
      <path d="M-64 -72 H64" />
      <circle cx="-52" cy="-74" r="7" fill="${C.yellow}" stroke="none" />
      <circle cx="-26" cy="-74" r="7" fill="${C.yellow}" stroke="none" />
      <path d="M-24 82 H24" stroke="${C.red}" />`,
  },
  {
    slug: 'electrical-technician',
    label: 'الكهربية',
    from: '#3B0E18', to: C.red, accent: C.yellow, pattern: 'lines',
    icon: `
      <path d="M24 -118 L-52 -6 H4 L-24 118 L60 -18 H2 Z" fill="${C.yellow}" stroke="none" />
      <path d="M-108 92 H108" opacity="0.45" stroke-width="6" />
      <circle cx="-88" cy="-86" r="6" fill="${C.white}" stroke="none" />
      <circle cx="102" cy="70" r="6" fill="${C.white}" stroke="none" />`,
  },
  {
    slug: 'machine-tools-technician',
    label: 'ماكينات الورشة',
    from: C.navy, to: '#52708F', accent: C.yellow, pattern: 'grid',
    icon: `
      <circle cx="0" cy="0" r="72" />
      <circle cx="0" cy="0" r="24" />
      <path d="M0 -96 V-72 M0 72 V96 M-96 0 H-72 M72 0 H96 M-68 -68 L-50 -50 M50 50 L68 68 M-68 68 L-50 50 M50 -50 L68 -68" stroke-width="13" />
      <path d="M-126 -104 H-58" stroke="${C.yellow}" stroke-width="8" />`,
  },
  {
    slug: 'garment-manufacturing-technician',
    label: 'الملابس الجاهزة',
    from: C.blue, to: C.red, accent: C.white, pattern: 'dots',
    icon: `
      <path d="M-56 -104 L-120 -58 L-84 -6 L-52 -26 V104 H52 V-26 L84 -6 L120 -58 L56 -104 C36 -82 -36 -82 -56 -104Z" />
      <path d="M-52 -26 C-20 -4 20 -4 52 -26" opacity="0.6" />
      <path d="M-132 78 L132 -78" stroke="${C.yellow}" stroke-width="6" />
      <circle cx="-132" cy="78" r="7" fill="${C.yellow}" stroke="none" />`,
  },
  {
    slug: 'industrial-electronics-technician',
    label: 'الإلكترونيات الصناعية',
    from: '#062B4D', to: C.blue, accent: C.yellow, pattern: 'grid',
    icon: `
      <rect x="-88" y="-88" width="176" height="176" rx="14" />
      <rect x="-34" y="-34" width="68" height="68" rx="8" />
      <path d="M-34 -12 H-70 M-34 12 H-70 M34 -12 H70 M34 12 H70 M-12 -34 V-70 M12 -34 V-70 M-12 34 V70 M12 34 V70" />
      <circle cx="-70" cy="-12" r="6" fill="${C.yellow}" stroke="none" />
      <circle cx="70" cy="12" r="6" fill="${C.yellow}" stroke="none" />
      <circle cx="12" cy="-70" r="6" fill="${C.yellow}" stroke="none" />`,
  },
  {
    slug: 'embedded-systems-ai-technician',
    label: 'الأنظمة المدمجة والذكاء الاصطناعي',
    from: C.navy, to: C.blueBright, accent: C.yellow, pattern: 'dots',
    icon: `
      <rect x="-78" y="-78" width="156" height="156" rx="18" />
      <path d="M-78 -34 H-118 V34 H-78 M78 -34 H118 V34 H78 M-34 -78 V-118 H34 V-78 M-34 78 V118 H34 V78" />
      <path d="M-34 -30 C-56 -48 -18 -66 0 -42 C18 -66 56 -48 34 -30 C58 -12 34 22 0 12 C-34 22 -58 -12 -34 -30Z" stroke="${C.yellow}" />
      <circle cx="0" cy="-14" r="7" fill="${C.yellow}" stroke="none" />
      <circle cx="-28" cy="-30" r="5" fill="${C.yellow}" stroke="none" />
      <circle cx="28" cy="-30" r="5" fill="${C.yellow}" stroke="none" />`,
  },
  {
    slug: 'computer-programming-technician',
    label: 'برمجة الحاسب',
    from: C.blue, to: C.navy, accent: C.yellow, pattern: 'lines',
    icon: `
      <path d="M-58 -96 L-132 0 L-58 96 M58 -96 L132 0 L58 96" />
      <path d="M28 -104 L-28 104" stroke="${C.yellow}" />
      <path d="M-116 112 H116" opacity="0.4" stroke-width="6" />`,
  },
  {
    slug: 'medical-devices-technician',
    label: 'صيانة الأجهزة الطبية',
    from: '#0A3B66', to: C.red, accent: C.white, pattern: 'dots',
    icon: `
      <path d="M-126 0 H-64 L-40 -56 L-8 72 L24 -20 L46 0 H126" stroke="${C.white}" />
      <path d="M-46 -102 H46 M0 -148 V-56" stroke="${C.yellow}" stroke-width="12" />
      <circle cx="0" cy="0" r="102" opacity="0.25" stroke-width="5" />`,
  },
  {
    slug: 'chemical-laboratory-technician',
    label: 'المعمل الكيميائي',
    from: C.navy, to: '#3E7E9C', accent: C.yellow, pattern: 'grid',
    icon: `
      <path d="M-30 -104 H30 M-12 -104 V-40 L-72 62 C-88 90 -68 112 -36 112 H36 C68 112 88 90 72 62 L12 -40 V-104" />
      <path d="M-48 48 H48" stroke="${C.yellow}" stroke-width="8" />
      <circle cx="-18" cy="72" r="9" fill="${C.yellow}" stroke="none" />
      <circle cx="22" cy="84" r="6" fill="${C.yellow}" stroke="none" />
      <circle cx="46" cy="60" r="5" fill="${C.white}" stroke="none" />`,
  },
  {
    slug: 'cnc-lathe-technician',
    label: 'مخارط CNC',
    from: '#3B0E18', to: C.blue, accent: C.yellow, pattern: 'lines',
    icon: `
      <rect x="-124" y="-104" width="92" height="72" rx="10" />
      <path d="M-104 -68 H-52 M-104 -48 H-76" stroke="${C.yellow}" stroke-width="7" />
      <path d="M-32 -40 H124 M-32 40 H124" />
      <rect x="-32" y="-64" width="44" height="128" rx="10" />
      <circle cx="44" cy="0" r="34" />
      <circle cx="44" cy="0" r="10" />
      <path d="M92 -22 V22" stroke="${C.yellow}" />`,
  },
  {
    slug: 'cnc-milling-technician',
    label: 'فرايز CNC',
    from: C.blue, to: C.red, accent: C.yellow, pattern: 'grid',
    icon: `
      <path d="M-124 96 H124 M-104 116 L-84 96 M84 96 L104 116" opacity="0.55" />
      <path d="M-104 -96 H104 M-104 -96 L-124 -76 M104 -96 L124 -76" opacity="0.55" />
      <path d="M0 -110 V-32" />
      <path d="M-26 -32 H26 L16 46 L0 74 L-16 46 Z" fill="${C.yellow}" stroke="none" />
      <path d="M-14 -18 H14 M-12 4 H12" stroke="${C.navy}" stroke-width="5" />
      <circle cx="0" cy="0" r="98" opacity="0.22" stroke-width="4" />`,
  },
];

function patternMarkup(kind, tint) {
  if (kind === 'grid') {
    return `<pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0 H0 V44" fill="none" stroke="${tint}" stroke-width="1.4" opacity="0.16" />
    </pattern>`;
  }
  if (kind === 'lines') {
    return `<pattern id="lines" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <path d="M0 0 V36" stroke="${tint}" stroke-width="2" opacity="0.13" />
    </pattern>`;
  }
  return `<pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="2" fill="${tint}" opacity="0.18" />
  </pattern>`;
}

for (const [index, cover] of covers.entries()) {
  const patternId = cover.pattern;
  const accent = cover.accent;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="رسم توضيحي لتخصص ${cover.label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${cover.from}" />
      <stop offset="1" stop-color="${cover.to}" />
    </linearGradient>
    ${patternMarkup(cover.pattern, C.white)}
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.34" />
      <stop offset="1" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="640" height="420" fill="url(#bg)" />
  <rect width="640" height="420" fill="url(#${patternId})" />
  <circle cx="${470 + (index % 3) * 26}" cy="${86 + (index % 2) * 34}" r="168" fill="${C.white}" opacity="0.05" />
  <circle cx="${104 + (index % 4) * 18}" cy="${374 - (index % 3) * 22}" r="132" fill="${accent}" opacity="0.10" />
  <circle cx="320" cy="210" r="176" fill="url(#glow)" />
  ${strokes(cover.icon, index % 3 === 1 ? C.white : C.white)}
  <g fill="none" stroke="${accent}" stroke-width="4" opacity="0.6">
    <path d="M52 338 H132 M52 338 V270" />
    <path d="M588 82 H518 M588 82 V150" />
  </g>
  <circle cx="52" cy="338" r="7" fill="${accent}" />
  <circle cx="588" cy="82" r="7" fill="${accent}" />
  <g fill="${accent}" opacity="0.9">
    <rect x="278" y="374" width="22" height="5" rx="2.5" />
    <rect x="309" y="374" width="22" height="5" rx="2.5" />
    <rect x="340" y="374" width="22" height="5" rx="2.5" />
  </g>
</svg>
`;
  writeFileSync(resolve(outDir, `real-${cover.slug}.svg`), svg, 'utf8');
}

console.log(`Generated ${covers.length} department covers in ${outDir}`);
