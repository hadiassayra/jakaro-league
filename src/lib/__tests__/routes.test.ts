import { Children, isValidElement, type ReactNode } from 'react';
import { createRoutesFromElements, matchRoutes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  vi.stubGlobal('sessionStorage', { getItem: () => null });
});
import { appRoutes } from '../../App';
import LivePage from '../../pages/LivePage';
import { SyncAccountGate } from '../../components/SyncAccountGate';

const routes = createRoutesFromElements(appRoutes);
function includesGate(node: ReactNode): boolean {
  return Children.toArray(node).some(child => isValidElement<{ children?: ReactNode }>(child) &&
    (child.type === SyncAccountGate || includesGate(child.props.children)));
}

describe('public and private navigation', () => {
  it('opens the public home without the admin account gate', () => {
    const matches = matchRoutes(routes, '/')!;
    expect(matches).toHaveLength(1);
    const element = matches[0].route.element;
    expect(isValidElement(element) && element.type).toBe(LivePage);
    expect(matches.some(m => includesGate(m.route.element))).toBe(false);
  });
  it('keeps every admin page behind the account gate', () => {
    for (const url of ['/admin', '/admin/teams', '/admin/matches', '/admin/settings', '/admin/team/example']) {
      const matches = matchRoutes(routes, url)!;
      expect(matches.some(m => includesGate(m.route.element))).toBe(true);
      expect(matches.at(-1)?.route.path).not.toBe('*');
    }
  });
  it('does not expose login on the other public screens', () => {
    for (const url of ['/live', '/match-display', '/show']) {
      expect(matchRoutes(routes, url)!.some(m => includesGate(m.route.element))).toBe(false);
    }
  });
});
