# Badminton Stats

Score tracking, fair match rotation and session reports for a one-court doubles group.
Runs for free on **Vercel (Hobby)** with **Firebase Firestore + Auth (Spark plan)**.

- **Next match planner.** Pick who's here and set their levels. The app plans who plays next so everyone gets an
  equal (or near-equal) number of games, with balanced teams and rotating partners. Any edit (a score, a swap,
  someone resting, a late arrival, a corrected past match) re-plans the upcoming matches instantly on every phone.
- **Late arrivals and breaks.** When someone joins late or comes back, you choose **Join fairly** (equal share from
  now on) or **Catch up** (priority until level with everyone).
- **Final-score entry.** Mark a game "stopped early" and it's shown with `*` and left out of the stats.
- **Session report.** Same layout as the old PDF reports: MVP, best partnership, tightest contest, standings,
  partnerships, auto-written (editable) takeaways and the match log. Share it as a **PDF** straight to WhatsApp or as a link.
- **Player profiles**, an all-time **leaderboard**, partnerships, head-to-head and past sessions.
- **Roles.** Anyone with the link can view. Only **admins** (Google sign-in) can change anything.
- **Phone-first.** Installable as an app, and keeps working without signal at the court (changes sync later).

## Run it locally (no Firebase account needed)

Requires Node 20+ and Java 21+ (for the Firebase emulators); `firebase-tools` is used via the global `firebase` command.

```bash
npm install
```

```bash
npm run emulators
```

In a second terminal:

```bash
npm run emulator:admin
```

```bash
npm run dev
```

Open http://localhost:5173, tap **Admin** (top right) and sign in as `admin@example.com`.
Emulator data is temporary and resets when the emulators stop.

## Put it online

### 1. Firebase (free Spark plan)

1. Go to https://console.firebase.google.com and create a project. Google Analytics isn't needed.
2. **Project settings → Your apps → Web app (`</>`)**: register an app and note the config values
   (`apiKey`, `authDomain`, `projectId`, `appId`). These identify the project and are public by design;
   the security rules are what protect the data.
3. **Build → Firestore Database → Create database**: choose production mode and the region nearest you.
4. **Build → Authentication → Sign-in method → Google → Enable.**
5. Deploy the security rules and index settings from this folder:

   ```bash
   firebase login
   ```

   ```bash
   firebase use --add
   ```

   ```bash
   firebase deploy --only firestore
   ```

6. **Make yourself the first admin.** In Firestore → *Start collection* `admins` → Document ID = your Google email
   in lowercase (e.g. `you@gmail.com`) → add any field (e.g. `addedAt`, number, `1`). You can add co-admins later
   from the app's **Admin** page.

### 2. Vercel (free Hobby plan)

1. Push this folder to a GitHub repository and **Import** it at https://vercel.com/new (framework: Vite), or run `npx vercel`.
2. In **Project → Settings → Environment Variables**, add the values from step 1.2 (see `.env.example`):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, then redeploy.
3. In Firebase **Authentication → Settings → Authorized domains**, add your Vercel domain (e.g. `your-app.vercel.app`).

### 3. First run

Open the site, tap **Admin** and sign in with Google. Then go to **Admin → Import past reports**, pick the date of each old
report, and import. Their 46 matches then count in everyone's all-time stats.

## How "Next match" decides

1. **Fairness first.** Each available player earns an equal share of the 4 court spots per match. Whoever is most
   "owed" a game plays next; among equals, whoever has waited longest. Resting players earn nothing.
   **Catch up** credits the matches someone missed.
2. **Then the best lineup.** Among equally-owed players, every combination and team split is scored on:
   team level gap (most important), repeat partners, repeat opponents, exact rematches, and a gentle nudge
   away from pairs that played together a lot in recent sessions. A one-match lookahead avoids leaving a
   lopsided match for later.
3. **Same answer on every phone.** Ties are broken deterministically. **Shuffle** cycles to the next-best lineup,
   and **Change players** pins your own lineup (everything after it re-plans).

The "Stop after M10 and everyone will have played 8" hint shows the next point where everyone is even.
Tuning and guarantees are covered by `src/lib/engine/scheduler.test.ts`.

## Free-tier budget

- **Reads.** A visit reads the player list plus about three documents. All-time stats come from one compact summary
  document (`meta/history`) instead of one read per session, so the free 50,000 reads a day covers thousands of visits.
- **Writes.** A session is roughly 50–100 writes, against 20,000 a day.
- **Storage.** The summary document holds roughly 500 sessions before reaching Firestore's 1 MB per-document limit.
  The Admin page shows how full it is.
- **Hosting.** Vercel only serves static files; no serverless functions are used.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | App on http://localhost:5173 (talks to the emulators, see `.env.development`) |
| `npm run emulators` | Local Firestore + Auth emulators (UI at http://localhost:4000) |
| `npm run emulator:admin -- email` | Make an email an admin in the emulator |
| `npm test` | Engine tests: stats reproduce the original PDF reports; scheduler fairness simulations |
| `npm run test:rules` | Security-rules tests against the Firestore emulator |
| `npm run build` | Type-check and production build (`dist/`) |
| `npm run lint` | ESLint |

## Project layout

```
src/lib/engine/      Pure logic: stats, report, takeaways, scheduler (+ tests, fixtures from the PDFs)
src/lib/data/        Firebase listeners (DataProvider, AuthProvider, useSession) and all writes (mutations.ts)
src/components/      UI: session (court, matches, report tabs), report (web + PDF), stats, ui primitives
src/pages/           Home, Sessions, New session, Session, Leaderboard, Players, Player, Admin
firestore.rules      Public read, admin-only write
```

## Notes on the original reports

The four original PDFs are reproduced exactly by `src/lib/engine/report.test.ts`, with two exceptions found while
checking them. The old *Saturday* report printed **434** total points and the old *Sunday* report **390**, but their own
match logs add up to **445** and **401** (every standings row agrees with the corrected totals).
