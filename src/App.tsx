import { lazy } from 'react';
import { createBrowserRouter, Link, Navigate, RouterProvider, useRouteError } from 'react-router';
import { AuthProvider } from './lib/data/AuthProvider';
import { DataProvider } from './lib/data/DataProvider';
import { firebaseConfigured } from './lib/firebase';
import { AppShell } from './components/layout/AppShell';
import { Empty } from './components/ui/Card';
import HomePage from './pages/HomePage';
import SessionsPage from './pages/SessionsPage';
import SessionPage from './pages/SessionPage';
import PlanPage from './pages/PlanPage';

// Heavier, less-visited pages load on demand (charts, admin tools).
const NewSessionPage = lazy(() => import('./pages/NewSessionPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MePage = lazy(() => import('./pages/MePage'));
const TournamentPage = lazy(() => import('./pages/TournamentPage'));
const TournamentScorerPage = lazy(() => import('./pages/TournamentScorerPage'));
const SessionMatchPage = lazy(() => import('./pages/SessionMatchPage'));

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
      // A planned session or tournament: where an invite link lands.
      { path: 'next/:id', element: <PlanPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'sessions/new', element: <NewSessionPage /> },
      { path: 'sessions/:id', element: <SessionPage /> },
      { path: 'sessions/:id/matches/:matchId', element: <SessionMatchPage /> },
      // Sessions and tournaments share one list (Play).
      { path: 'tournaments', element: <Navigate to="/sessions" replace /> },
      { path: 'tournaments/:id', element: <TournamentPage /> },
      { path: 'tournaments/:id/matches/:matchId', element: <TournamentScorerPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'players', element: <PlayersPage /> },
      { path: 'players/:id', element: <PlayerPage /> },
      { path: 'me', element: <MePage /> },
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
