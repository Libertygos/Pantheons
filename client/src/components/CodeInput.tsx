/**
 * Saisie segmentée du code de salon : une case par caractère (ROOM_CODE_LENGTH = 5 côté
 * serveur), avance automatique, retour arrière qui remonte, collage qui remplit depuis la
 * case active. La valeur reste une simple chaîne compacte en majuscules — la
 * normalisation finale reste server-side (normalizeRoomCode).
 */
import { useRef } from 'react';
import { fr } from '../i18n/fr.js';

const CLEAN = /[^A-Z0-9]/g;

export function CodeInput({
  value,
  onChange,
  length = 5,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  const handleChange = (idx: number, raw: string) => {
    const txt = raw.toUpperCase().replace(CLEAN, '');
    const next = txt
      ? (value.slice(0, idx) + txt + value.slice(idx + txt.length)).slice(0, length)
      : value.slice(0, idx) + value.slice(idx + 1);
    onChange(next);
    if (txt) refs.current[Math.min(idx + txt.length, length - 1)]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[idx] && idx > 0) {
      e.preventDefault();
      onChange(value.slice(0, idx - 1) + value.slice(idx));
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      refs.current[idx + 1]?.focus();
    }
  };

  return (
    <div className="code-seg" role="group" aria-label={fr.landing.joinTitle}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`code-seg__case ${c ? 'code-seg__case--pleine' : ''}`}
          value={c}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={fr.landing.codeChar(i + 1, length)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
      ))}
    </div>
  );
}
