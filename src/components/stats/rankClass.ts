/** Podium colours: volt for the leader, silver and bronze after (fixed fills with dark text in both themes). */
export function rankClass(rank: number) {
  return rank === 1
    ? 'bg-volt text-volt-ink ring-volt-ink/15'
    : rank === 2
      ? 'bg-[#dfe4e2] text-[#24302b] ring-[#24302b]/15'
      : rank === 3
        ? 'bg-[#ecc9a4] text-[#4a2a10] ring-[#4a2a10]/15'
        : 'bg-surface-2 text-muted ring-line';
}
