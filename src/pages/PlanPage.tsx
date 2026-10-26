import { Link, Navigate, useParams } from 'react-router';
import { CalendarX } from 'lucide-react';
import { usePlannedEvent } from '../lib/data/usePlannedEvent';
import { todayISO } from '../lib/format';
import { PlannedCard } from '../components/session/NextSessionCard';
import { Empty, Spinner } from '../components/ui/Card';

/**
 * Where an invite link lands: the planned session or tournament on its own, to say if you're in. Once it
 * has started, the link goes straight to the session or tournament it became.
 */
export default function PlanPage() {
  const { id } = useParams();
  const { plan, loading, error } = usePlannedEvent(id);
  if (loading) return <Spinner />;

  if (plan?.status === 'started' && plan.sessionId) {
    return <Navigate to={`/${plan.kind === 'tournament' ? 'tournaments' : 'sessions'}/${plan.sessionId}`} replace />;
  }
  if (!plan || plan.status !== 'planned' || plan.date < todayISO()) {
    const title = error ? "Couldn't open this invite" : !plan || plan.status === 'cancelled' ? 'This one was cancelled' : 'This one has been and gone';
    return (
      <Empty icon={<CalendarX size={28} />} title={title}>
        {error && <p>{error}</p>}
        <Link to="/" className="mt-1 inline-block font-semibold underline">
          See what's coming up
        </Link>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <PlannedCard next={plan} />
      <div className="flex justify-end">
        <Link to="/" className="text-sm font-semibold text-primary-text hover:underline">
          See everything coming up
        </Link>
      </div>
    </div>
  );
}
