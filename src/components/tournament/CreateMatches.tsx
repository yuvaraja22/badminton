import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, WandSparkles } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { addGeneratedMatches } from '../../lib/data/mutations';
import { generateMatches } from '../../lib/engine/autoMatches';
import { establishedLevel } from '../../lib/engine/rating';
import { tournamentMatches } from '../../lib/engine/tournament';
import { matchCode, oneDecimal } from '../../lib/format';
import { levelName } from '../../lib/levels';
import { teamName } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament } from '../../lib/types';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Notice } from '../ui/Card';
import { Segmented } from '../ui/Segmented';
import { SideNames, TeamDot } from './TeamBits';

const MAX = 30;
const KEYS: TeamKey[] = ['a', 'b'];
const count = (v: string) => Math.min(MAX, Math.max(0, Math.floor(Number(v) || 0)));

/**
 * "Create matches": each team ranked best first (by skill rating, or level for newer players), which
 * the admin can reorder; then how many doubles and singles. Matches pair the same ranks (A1 & A2 vs
 * B1 & B2, A1 & A3 vs B1 & B3…) and keep everyone's games even, singles mixed in between.
 */
export function CreateMatchesForm({ t, onDone }: { t: Tournament; onDone: () => void }) {
  const { nameOf, ratings, playersById } = useData();
  const strength = (id: PlayerId) => establishedLevel(ratings.get(id)) ?? playersById.get(id)?.level ?? 3;
  const shown = (id: PlayerId) => {
    const r = establishedLevel(ratings.get(id));
    return r !== null ? `Rating ${oneDecimal(r)}` : levelName(playersById.get(id)?.level ?? 3);
  };
  const [order, setOrder] = useState<Record<TeamKey, PlayerId[]>>(() => {
    const rank = (ids: PlayerId[]) => [...ids].sort((x, y) => strength(y) - strength(x) || nameOf(x).localeCompare(nameOf(y)));
    return { a: rank(t.teams.a.players), b: rank(t.teams.b.players) };
  });
  const sizes = { a: order.a.length, b: order.b.length };
  const canDoubles = sizes.a >= 2 && sizes.b >= 2;
  const [doubles, setDoubles] = useState(String(canDoubles ? Math.max(sizes.a, sizes.b) : 0));
  const [singles, setSingles] = useState(String(Math.min(sizes.a, sizes.b)));
  const unplayed = tournamentMatches(t).filter((m) => m.status === 'scheduled').length;
  const [replace, setReplace] = useState(false);

  const list = useMemo(() => generateMatches(order.a, order.b, canDoubles ? count(doubles) : 0, count(singles)), [order, doubles, singles, canDoubles]);
  const firstOrder = (replace ? tournamentMatches(t).filter((m) => m.status !== 'scheduled').length : Math.max(0, ...Object.values(t.matches).map((m) => m.order))) + 1;

  // How many matches each player gets, to show the spread.
  const perPlayer = new Map<PlayerId, number>();
  for (const m of list) for (const id of [...m.a, ...m.b]) perPlayer.set(id, (perPlayer.get(id) ?? 0) + 1);
  const counts = [...perPlayer.values()];
  const spread = counts.length ? (Math.min(...counts) === Math.max(...counts) ? `${counts[0]} each` : `${Math.min(...counts)}–${Math.max(...counts)} each`) : null;

  const move = (team: TeamKey, i: number, dir: -1 | 1) =>
    setOrder((o) => {
      const ids = [...o[team]];
      [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
      return { ...o, [team]: ids };
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Best first: the order sets who plays whom (A1 &amp; A2 vs B1 &amp; B2, then A1 &amp; A3 vs B1 &amp; B3…). Move players up or down to change it.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KEYS.map((k) => (
          <div key={k} className="rounded-2xl border border-line">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
              <TeamDot t={t} team={k} /> {teamName(t, k)}
            </div>
            <ol className="divide-y divide-line text-sm">
              {order[k].map((id, i) => (
                <li key={id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="font-score w-7 shrink-0 text-base font-black text-muted">
                    {k.toUpperCase()}
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{nameOf(id)}</span>
                    <span className="block text-xs text-muted">{shown(id)}</span>
                  </span>
                  <button type="button" disabled={i === 0} onClick={() => move(k, i, -1)} aria-label={`Move ${nameOf(id)} up`} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-25">
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={i === order[k].length - 1}
                    onClick={() => move(k, i, 1)}
                    aria-label={`Move ${nameOf(id)} down`}
                    className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-25"
                  >
                    <ArrowDown size={15} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Doubles matches" hint={canDoubles ? undefined : 'Each team needs two players.'}>
          <Input type="number" inputMode="numeric" min={0} max={MAX} value={canDoubles ? doubles : '0'} disabled={!canDoubles} onChange={(e) => setDoubles(e.target.value)} />
        </Field>
        <Field label="Singles matches">
          <Input type="number" inputMode="numeric" min={0} max={MAX} value={singles} onChange={(e) => setSingles(e.target.value)} />
        </Field>
      </div>

      {unplayed > 0 && (
        <Segmented
          value={replace ? 'replace' : 'add'}
          onChange={(v) => setReplace(v === 'replace')}
          options={[
            { value: 'add', label: 'Add after the current ones' },
            { value: 'replace', label: `Replace the ${unplayed} not played` },
          ]}
        />
      )}

      {list.length > 0 ? (
        <div className="rounded-2xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-[0.12em]">Preview</span>
            {spread && <span>{spread}</span>}
          </div>
          <ol className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
            {list.map((m, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="font-score w-10 shrink-0 text-base font-black">{matchCode(firstOrder + i)}</span>
                <span className="w-14 shrink-0 text-xs text-muted">{m.kind === 'doubles' ? 'Doubles' : 'Singles'}</span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <SideNames t={t} team="a" ids={m.a} />
                  <SideNames t={t} team="b" ids={m.b} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Notice>Set how many doubles and singles to play.</Notice>
      )}

      <Button
        block
        disabled={!list.length}
        onClick={() => {
          addGeneratedMatches(t, list, replace);
          onDone();
        }}
      >
        <WandSparkles size={16} /> Create {list.length} match{list.length === 1 ? '' : 'es'}
      </Button>
    </div>
  );
}
