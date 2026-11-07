import { useEffect, useState } from 'react';
import { fr } from '../i18n/fr.js';

/** #1834 : compte à rebours partagé (échéance serveur en ms epoch) des deux fenêtres de 30 s. */
export function Countdown({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className="compte-a-rebours" role="timer" aria-label={fr.fenetre.restant(s)}>
      {s} s
    </span>
  );
}
