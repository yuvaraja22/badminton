import { lazy } from 'react';
import { createBrowserRouter, Link, RouterProvider, useRouteError } from 'react-router';
import { AuthProvider } from './lib/data/AuthProvider';
import { DataProvider } from './lib/data/DataProvider';
import { firebaseConfigured } from './lib/firebase';
import { AppShell } from './components/layout/AppShell';
import { Empty } from './components/ui/Card';
import HomePage from './pages/HomePage';
import SessionsPage from './pages/SessionsPage';
import SessionPage from './pages/SessionPage';

// Heavier, less-visited pages load on demand (charts, admin tools).
const NewSessionPage = lazy(() => import('./pages/NewSessionPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function RouteError() {
  const error = useRouteError() as Error | undefined;
  return (
    <div className="mx-auto max-w-md p-6">
      <Empty title="Something went wrong">
        <p>{error?.message ?? 'Unknown error'}</p>
        <Link to="/" className="mt-2 inline-block font-semibold underline">
          Back to home
        </Link>
      </Empty>
    </div>
  );
}

function NotFound() {
  return (
    <Empty title="Page not found">
      <Link to="/" className="font-semibold underline">
        Back to home
      </Link>
    </Empty>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'sessions/new', element: <NewSessionPage /> },
      { path: 'sessions/:id', element: <SessionPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'players', element: <PlayersPage /> },
      { path: 'players/:id', element: <PlayerPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Empty title="Firebase isn't configured yet">
        <p>
          Set the <code>VITE_FIREBASE_*</code> environment variables (see <code>.env.example</code> and the README), then redeploy.
        </p>
      </Empty>
    </div>
  );
}

export default function App() {
  if (!firebaseConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <DataProvider>
        <RouterProvider router={router} />
      </DataProvider>
    </AuthProvider>
  );
}
