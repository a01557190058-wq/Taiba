/**
 * Splits a phrase into words so CSS can stagger their entrance.
 * Stays a single readable string for assistive technology and search engines.
 */
export default function SplitWords({ text, className = '' }) {
  return (
    <span className={`split-words ${className}`.trim()}>
      {text.split(' ').map((word, index) => (
        <span className="split-words__word" key={`${word}-${index}`}>
          {word}
        </span>
      ))}
    </span>
  );
}
