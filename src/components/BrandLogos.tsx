import { Logo } from './Logo';
import tmaxLogo from '../assets/brand/tmax-energy-drink.svg';

export function BrandLogos({ src, variant = 'auto', size = 'compact' }: {
  src: string | null | undefined;
  variant?: 'auto' | 'badge' | 'outline';
  size?: 'compact' | 'standard' | 'presentation' | 'print';
}) {
  return <span className={`brand-logos brand-logos--${size}`}>
    <Logo src={src} variant={variant} className="brand-logos-primary" />
    <span className="brand-logos-divider" aria-hidden="true" />
    <img src={tmaxLogo} alt="TMAX Energy Drink" className="brand-logos-partner" decoding="async" />
  </span>;
}
