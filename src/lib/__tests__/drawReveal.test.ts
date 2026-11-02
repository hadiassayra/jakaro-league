import { describe, expect, it } from 'vitest';
import { drawRevealOrder } from '../drawReveal';
import { seededRandom } from '../id';
import type { Team } from '../types';

describe('participant draw presentation', () => {
  const teams: Team[] = Array.from({ length: 28 }, (_, i) => ({ id: `t${i}`, name: `team${i}`, player1: '', player2: '', group: i % 2 ? 'A' : 'B', availableDays: [6] }));
  it('reveals every approved team exactly once without changing groups', () => {
    const result = drawRevealOrder(teams, seededRandom(2));
    expect(new Set(result.map(t => t.id)).size).toBe(28);
    expect(result.filter(t => t.group === 'A')).toHaveLength(14);
    for (const team of result) expect(team.group).toBe(teams.find(t => t.id === team.id)!.group);
    expect(result.map(t => t.id)).not.toEqual(teams.map(t => t.id));
  });
  it('does not mutate the tournament when presentation state changes', () => {
    const before = structuredClone(teams);
    const result = drawRevealOrder(teams, seededRandom(2));
    result[0].group = null; result[0].availableDays!.push(1);
    expect(teams).toEqual(before);
  });
  it('requires complete and unambiguous approved assignments', () => {
    expect(() => drawRevealOrder([])).toThrow();
    expect(() => drawRevealOrder([{ ...teams[0], group: null }])).toThrow();
    expect(() => drawRevealOrder([teams[0], teams[0]])).toThrow();
  });
});
