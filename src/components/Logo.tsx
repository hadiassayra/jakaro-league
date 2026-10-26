import { useEffect, useState } from 'react';

/**
 * Built-in version of the FICTION Board Games Cafe badge, used until a logo is
 * uploaded in Settings. If a file named public/logo.png exists it is used instead.
 */
export function DefaultLogo({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1150 450"
      className={className}
      style={style}
      role="img"
      aria-label="FICTION Board Games Cafe"
    >
      <rect width="1150" height="450" rx="48" fill="#13208f" />
      <g transform="translate(50 40)">
        <path d="M45 4 H1000 L1048 44 L1044 222 L1004 262 H48 L4 224 L8 46 Z" fill="#fff" />
        <rect x="30" y="24" width="988" height="214" rx="24" fill="#13208f" transform="rotate(-0.6 524 131)" />
        <text
          x="524"
          y="206"
          textAnchor="middle"
          fill="#ffde00"
          fontFamily="'Arial Black', 'Lalezar', Impact, sans-serif"
          fontWeight="900"
          fontSize="190"
          textLength="900"
          lengthAdjust="spacingAndGlyphs"
          transform="rotate(-0.6 524 131)"
        >
          FICTION
        </text>
        <text
          x="524"
          y="352"
          textAnchor="middle"
          fill="#fff"
          fontFamily="'Arial Black', Impact, sans-serif"
          fontWeight="900"
          fontSize="74"
          textLength="680"
          lengthAdjust="spacingAndGlyphs"
        >
          BOARD GAMES CAFE
        </text>
      </g>
    </svg>
  );
}

let publicLogo: Promise<string | null> | null = null;
function probePublicLogo(): Promise<string | null> {
  publicLogo ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve('./logo.png');
    img.onerror = () => resolve(null);
    img.src = './logo.png';
  });
  return publicLogo;
}

export function Logo({
  src,
  className = '',
  style,
}: {
  src: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [fallback, setFallback] = useState<string | null>(null);
  useEffect(() => {
    if (!src) void probePublicLogo().then(setFallback);
  }, [src]);
  const url = src || fallback;
  if (!url) return <DefaultLogo className={className} style={style} />;
  return <img src={url} alt="الشعار" className={`object-contain ${className}`} style={style} />;
}
