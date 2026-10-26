import { useLocation, useNavigate } from 'react-router-dom';

export function BackButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return <button type="button" className={`btn btn-ghost btn-sm whitespace-nowrap ${className}`} onClick={() => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else {
      const query = window.location.hash.split('?')[1];
      navigate(query ? `${location.pathname === '/live' ? '/match-display' : '/live'}?${query}` : '/');
    }
  }}>→ رجوع</button>;
}
