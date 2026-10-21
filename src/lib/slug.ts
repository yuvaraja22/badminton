import type { Player, PlayerId } from './types';

/** URL-friendly name: "Sri Dhar" → "sri-dhar". Keeps letters from any script (e.g. Tamil names). */
export function playerSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'player';
}

/**
 * Profile URL for a player: /players/<name> when that name is unique, otherwise /players/<id>.
 * (Names are kept unique by the app, so the id form is only a fallback.)
 */
export function playerPath(players: Player[], id: PlayerId): string {
  const player = players.find((p) => p.id === id);
  if (!player) return `/players/${id}`;
  const slug = playerSlug(player.name);
  const clash = players.some((p) => p.id !== id && playerSlug(p.name) === slug);
  return `/players/${clash ? id : encodeURIComponent(slug)}`;
}

/** Find a player from a profile URL segment: either their id or their name slug. */
export function findPlayer(players: Player[], param: string): Player | undefined {
  const byId = players.find((p) => p.id === param);
  if (byId) return byId;
  const wanted = playerSlug(param);
  const matches = players.filter((p) => playerSlug(p.name) === wanted);
  return matches.find((p) => p.active) ?? matches[0];
}
