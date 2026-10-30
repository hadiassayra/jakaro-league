import type { Match } from '../lib/types';
import { cardsFor } from '../lib/discipline';

export function CardsBadge({ match, teamId }: { match: Match; teamId: string | null }) {
  const cards = cardsFor(match, teamId);
  if (!cards.yellow && !cards.red) return null;
  return <span className="inline-flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold" aria-label={`${cards.yellow} بطاقة صفراء${cards.red ? ' وبطاقة حمراء' : ''}`}>
    {cards.yellow > 0 && <span className="inline-flex items-center gap-1 rounded bg-m-yellow/15 px-1.5 py-1 text-accent-ink"><span aria-hidden="true" className="inline-block h-4 w-2.5 rounded-sm bg-m-yellow" />{cards.yellow}</span>}
    {cards.red && <span className="inline-flex items-center gap-1 rounded bg-loss/15 px-1.5 py-1 text-loss"><span aria-hidden="true" className="inline-block h-4 w-2.5 rounded-sm bg-loss" />حمراء</span>}
    {cards.yellow >= 2 && match.stage === 'group' && <span className="text-loss">−١ نقطة</span>}
  </span>;
}
