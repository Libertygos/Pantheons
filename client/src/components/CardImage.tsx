/** Displays an immutable card PNG with a labelled fallback tile until art is pushed. */
import { useState } from 'react';

export function CardImage({ src, label, width = 96 }: { src: string; label: string; width?: number }) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 1.4);
  if (failed) {
    return (
      <div
        style={{
          width,
          height,
          border: '1px solid #6b5b95',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 4,
          fontSize: 11,
          background: '#1c1830',
          color: '#cdbde8',
        }}
        title={label}
      >
        {label}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      width={width}
      height={height}
      style={{ borderRadius: 8, objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  );
}
