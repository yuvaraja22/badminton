import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Match codes as written in reports and highlights: "M5", "M05", "M12". */
const CODE = /\bM(\d{1,3})\b/g;

/** Text with every match code ("M05") linked to that match, when `hrefOf` knows it. */
export function MatchLinks({ text, hrefOf }: { text: string; hrefOf?: (n: number) => string | null }) {
  if (!hrefOf) return <>{text}</>;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE)) {
    const href = hrefOf(Number(match[1]));
    if (!href) continue;
    parts.push(text.slice(last, match.index));
    parts.push(
      <Link key={match.index} to={href} className="font-semibold underline decoration-1 underline-offset-2 hover:decoration-2">
        {match[0]}
      </Link>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
