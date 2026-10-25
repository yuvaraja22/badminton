import { useState } from 'react';
import { History } from 'lucide-react';
import { formatStamp } from '../lib/format';
import type { EditEntry } from '../lib/types';
import { MatchLinks } from './report/MatchLinks';
import { Card, CardHeader } from './ui/Card';

const SHOWN = 8;

/** Who entered or changed which result, and when: newest first, a few at a time. */
export function EditHistory({ edits, hrefOf }: { edits: EditEntry[]; hrefOf?: (n: number) => string | null }) {
  const [all, setAll] = useState(false);
  if (!edits.length) return null;
  const list = [...edits].sort((a, b) => b.at - a.at);
  const shown = all ? list : list.slice(0, SHOWN);
  return (
    <Card>
      <CardHeader title="Change history" subtitle="Who entered or changed results, newest first." action={<History size={18} className="text-muted" />} />
      <ul className="divide-y divide-line px-4 pt-2 pb-1 text-sm">
        {shown.map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
            <span className="min-w-0">
              <MatchLinks text={e.text} hrefOf={hrefOf} />
            </span>
            <span className="shrink-0 text-xs text-muted">
              {e.by} · {formatStamp(e.at)}
            </span>
          </li>
        ))}
      </ul>
      {list.length > SHOWN && (
        <div className="border-t border-line p-2 text-center">
          <button type="button" className="rounded-full px-3 py-1 text-sm font-semibold hover:bg-surface-2" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show all ${list.length}`}
          </button>
        </div>
      )}
    </Card>
  );
}
