import { useEffect, useState, type CSSProperties } from 'react';
import badgeLogo from '../assets/brand/fiction-badge.png';
import outlineLogo from '../assets/brand/fiction-outline.png';

type LogoVariant = 'auto' | 'badge' | 'outline';
type LogoProps = { className?: string; style?: CSSProperties; variant?: LogoVariant };

/** Use the outlined logo on dark surfaces and the blue badge on light surfaces. */
export function DefaultLogo({ className = '', style, variant = 'auto' }: LogoProps) {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    if (variant !== 'auto') return;
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [variant]);
  const selected = variant === 'auto' ? dark ? 'outline' : 'badge' : variant;
  return <img
    src={selected === 'outline' ? outlineLogo : badgeLogo}
    alt="FICTION Board Games Cafe"
    className={`fiction-brand fiction-brand--${selected} object-contain ${className}`}
    style={style}
    decoding="async"
  />;
}

export function Logo({ src, className = '', style, variant = 'auto' }: LogoProps & { src: string | null | undefined }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || src === failed) return <DefaultLogo className={className} style={style} variant={variant} />;
  return <img src={src} alt="شعار البطولة" className={`object-contain ${className}`} style={style} onError={() => setFailed(src)} />;
}
