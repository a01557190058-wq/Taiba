const WORDS = [
  'تعلّم تطبيقي',
  'برمجة',
  'هندسة',
  'ذكاء اصطناعي',
  'طاقة متجددة',
  'مشروعات حقيقية',
  'مختبرات وورش',
  'مهارات المستقبل',
];

/** Decorative brand ribbon. CSS handles the infinite motion. */
export default function BrandTicker() {
  return (
    <div className="brand-ticker" aria-hidden="true">
      <div className="brand-ticker__track">
        {[...WORDS, ...WORDS].map((word, index) => (
          <span className="brand-ticker__item" key={`${word}-${index}`}>
            <span className="brand-ticker__star">✦</span>
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
