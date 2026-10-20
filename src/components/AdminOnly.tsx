import { LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/data/context';
import { usingEmulators } from '../lib/firebase';
import { Button } from './ui/Button';
import { Empty, Spinner } from './ui/Card';

/** Shown in place of admin-only screens. */
export function AdminOnly({ what }: { what: string }) {
  const { user, loading, signIn } = useAuth();
  if (loading) return <Spinner />;
  if (!user) {
    return (
      <Empty icon={<LogIn size={28} />} title={`Sign in to ${what}`}>
        <p>Only admins can make changes. Everyone else can view stats and reports without signing in.</p>
        <Button className="mt-3" onClick={() => signIn(usingEmulators ? 'admin@example.com' : undefined)}>
          Sign in with Google
        </Button>
      </Empty>
    );
  }
  return (
    <Empty icon={<ShieldAlert size={28} />} title="You're signed in, but not an admin">
      <p>
        {user.email} can view everything but can't {what}. An existing admin can add this email under Admin → Admins.
      </p>
    </Empty>
  );
}
