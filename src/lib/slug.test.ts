import { describe, expect, it } from 'vitest';
import type { Player } from './types';
import { findPlayer, playerPath, playerSlug } from './slug';

const p = (id: string, name: string, active = true): Player => ({ id, name, level: 3, active });

describe('profile links', () => {
  it('turns names into readable URL parts', () => {
    expect(playerSlug('Vikram')).toBe('vikram');
    expect(playerSlug('  Sri Dhar ')).toBe('sri-dhar');
    expect(playerSlug("Anu K.")).toBe('anu-k');
    expect(playerSlug('José')).toBe('jose');
    expect(playerSlug('யுவா')).not.toBe('player');
    expect(playerSlug('!!!')).toBe('player');
  });

  it('links by name, falling back to the id when two names share a slug', () => {
    const players = [p('a1', 'Vikram'), p('b2', 'Sri Dhar'), p('c3', 'Sri-Dhar')];
    expect(playerPath(players, 'a1')).toBe('/players/vikram');
    expect(playerPath(players, 'b2')).toBe('/players/b2');
  });

  it('finds a player by id or by name in the URL', () => {
    const players = [p('a1', 'Vikram'), p('b2', 'Anu')];
    expect(findPlayer(players, 'a1')?.name).toBe('Vikram');
    expect(findPlayer(players, 'vikram')?.id).toBe('a1');
    expect(findPlayer(players, 'Vikram')?.id).toBe('a1');
    expect(findPlayer(players, 'nobody')).toBeUndefined();
  });
});
