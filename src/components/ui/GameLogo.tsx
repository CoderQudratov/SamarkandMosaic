import { useState } from 'react';
import logoUrl from '@/assets/logo.png';
import { TimuridStar } from './TimuridStar';
import { COLORS } from '@/constants';

interface GameLogoProps {
  /** Square footprint in px — image is contained inside, keeping aspect ratio. */
  size?: number;
  glow?: boolean;
}

// Renders the real game logo. If the asset fails to load, it falls back to the
// procedural TimuridStar automatically (same footprint → no layout shift).
export function GameLogo({ size = 128, glow = true }: GameLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <TimuridStar size={size} glowing={glow} />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={logoUrl}
        alt="Samarkand Mosaic"
        draggable={false}
        onError={() => setFailed(true)}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          filter: glow
            ? `drop-shadow(0 0 16px ${COLORS.gold}) drop-shadow(0 0 30px rgba(212,175,55,0.5))`
            : undefined,
        }}
      />
    </div>
  );
}
