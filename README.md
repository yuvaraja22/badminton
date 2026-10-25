# Badminton Stats

Score tracking, fair match rotation and session reports for a one-court doubles group.
Runs for free on **Vercel (Hobby)** with **Firebase Firestore + Auth (Spark plan)**.

- **Next match planner.** Pick who's here and set their levels (Amateur Low … Professional High). The app plans who plays next so everyone gets an
  equal (or near-equal) number of games, with balanced teams and rotating partners. Any edit (a score, a swap,
  someone resting, a late arrival, a corrected past match) re-plans the upcoming matches instantly on every phone.
- **Late arrivals and breaks.** When someone joins late or comes back, you choose **Join fairly** (equal share from
  now on) or **Catch up** (priority until level with everyone).
- **Final-score entry.** Mark a game "stopped early" and it's shown with `*` and left out of the stats. A score that
  can't finish a game (21–20 in a game to 21) asks for a second tap, in case it's a typo.
- **Live scoring for sessions too.** On the Court tab, **Score point by point instead** opens the same full-screen scorer
  tournaments use: tap a side for a point, **Undo**, swap sides. Everyone else can watch the score live (Home shows it
  too). When it's over, **Start M06 and score it** puts the next planned match on court. Matches scored this way get the
  point-by-point stats in the session report and its PDF.
- **Serve indicator.** The scorer shows who serves and from which side: the side that won the last rally serves, from the
  right on an even score and the left on an odd one (at 0–0, tap who serves first).
- **Session report.** Same layout as the old PDF reports: MVP, best partnership, tightest contest, standings,
  partnerships, auto-written (editable) takeaways and the match log. Share it as a **PDF** straight to WhatsApp or as a link.
- **Player profiles**, an all-time **leaderboard**, partnerships, head-to-head and past sessions.
- **Skill ratings.** An [OpenSkill](https://github.com/philihp/openskill.js) doubles rating, replayed from every finished
  game and shown on the level scale (e.g. 3.7). It starts from the level on the player's profile (so changing that
  level re-bases their rating), moves more for beating stronger teams and for bigger wins, and becomes less certain
  while someone is away. Once a player has 8 rated games the planner balances teams by their rating, unless an admin
  sets a level for that session: by changing it on the New session screen, when adding a late arrival, or by tapping
  the player during the session (**Balance teams by: Rating / Level for today**).
  Player pages (and the Me tab) chart the rating after every session, and the court shows each team's **win chance**
  (e.g. "Slight edge: Team 1 · 61% – 39%") for the match on court, up next and in the queue. The words follow the
  percentages: up to 57% is an even match, 70% or more means one team is stronger.
- **Team tournaments.** Two teams (optional names, team colours), players on Team A, Team B or both (a common player
  plays for whichever side each match says) — set up with **Save teams**, then **Edit teams** / **Update teams** — and a
  hand-made schedule of doubles and singles with tentative times (auto-filled from a start time, then editable).
  **Share** (link, PDF or download) opens the tournament in the app; the PDF is the schedule before it starts and the
  full results after. The **live scorer** is full screen: tap a team's half for a point, **Undo**, swap sides;
  it calls game point, deuce and change of ends, and everyone watching sees the score as it happens. Games are to 21
  (win by 2, max 30); the scorer can switch a match to any target, e.g. 15 (max 21) or 10 (max 14). Most matches won
  takes the tournament, total points break a tie. **Results** has the same report as a session (MVP, standings,
  partnerships, takeaways, match log) plus **point-by-point** stats from the scorer: longest run, biggest comeback,
  game points saved, who reached 11 first, and a score-flow chart per match (in the app and the PDF). Once finished,
  its matches count in the stats exactly like sessions — profiles, leaderboard, partnerships, ratings — singles included.
- **Create matches (tournaments).** After picking the teams, **Create matches** ranks each team best first (by rating,
  which you can reorder) and asks how many doubles and singles. Doubles pair the same ranks: A1 & A2 vs B1 & B2, then
  A1 & A3 vs B1 & B3, then whoever has played least; singles are A1 vs B1, A2 vs B2… mixed in so as few players as
  possible play twice in a row. You see the list before anything is saved, and can add it after the current matches or
  replace the ones not played yet.
- **Play.** Sessions and tournaments in one list (live first, then coming up, then newest). **New** asks Session or
  Tournament.
- **Roles.** Anyone with the link can view. **Admins** (Google sign-in) run sessions and manage players.
- **Player accounts.** An admin links a player to their Google email (player → Edit → Linked Google account). That
  player can then edit their own photo, name, bio and playing style, RSVP to the next session and see a personal **Me** tab.
- **"This is me".** Someone signed in with Google but not linked yet taps **This is me** on their profile (or picks their
  name on the Me tab); an admin approves it on the Admin page (a dot on Admin says one is waiting).
- **Next up.** Admins plan sessions or tournaments (or start one now); players tap **I'm in** or **Can't make
  it**, and can say they're bringing guests. A plan can have a **most players** limit: later answers go on a waitlist and
  move up when someone drops out. **Repeat every week** plans the next one when this one starts (or **Skip this week**).
  **Share invite** sends it to WhatsApp. Starting a session pre-ticks everyone with a spot; a tournament lists them first
  when picking teams.
- **Guests.** A one-off visitor can be added as a guest: they play and appear in that session's report, but stay off the
  players list and the leaderboards.
- **Phone-first.** Installable as an app, and keeps working without signal at the court (changes sync later). The header
  says when it's **Offline · 3 to sync**, still **Saving…**, or **Saved**, and the app never reloads itself for an update
  in the middle of a match, a dialog or unsaved scores. Light and dark themes (Claude-style warm dark), following the
  device or picked from the header.
- **Home and leaderboard** show the last 30 days, with this **season** (quarters: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)
  and all-time one tap away. Each season has a champion and each month a **Player of the Month** (the top of that
  period's table). Home also lists recent **milestones** (100 games, 5 wins in a row, a first MVP…). Admins tap a
  player's photo to change it.
- **Streaks and milestones** on every profile: the run they're on, their best run of wins, how often they turn up, and
  their badges (games, wins, MVPs, unbeaten sessions, deuce games won, seasons and months won).
- **How good are the win chances?** The leaderboard shows how often the favourite actually won, and partnerships can be
  ranked by **Beat the odds**: wins above what their ratings expected against the opposition they faced.
- **Change history.** Every session and tournament keeps who entered or changed which result, and when.
- **Recently deleted.** Deleting a session or tournament moves it to Admin → Recently deleted for 30 days; **Restore** puts
  it back exactly as it was, stats included.

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

Open http://localhost:5173, tap **Sign in** (top right) and sign in as `admin@example.com`.
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

Open the site, tap **Sign in** (top right) and use the Google account you made admin. To give a player their own login,
open their profile → **Edit** → **Linked Google account** and enter their Gmail address.

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

## Safety net

- **Checks on every push and pull request** (`.github/workflows/checks.yml`): types, lint, unit tests, the build and the
  security-rules tests. Vercel also runs lint and the unit tests before every deploy (`npm run vercel-build`), so a
  change that breaks them never goes live; the site stays on the last good version.
- **Backups.** Admin → **Download backup** saves everything as one file (players, every session and tournament, plans,
  settings, accounts). Admin → **Restore from backup** brings back only what's missing from the app now; it never changes
  anything that's still there. Older backup files (players + stats summary) work too.
- **Nightly backups** (`.github/workflows/backup.yml`) save the same file every night, kept 90 days under
  GitHub → Actions → Nightly backup → a run → Artifacts. One-time setup:
  1. Google Cloud console → IAM & Admin → **Service accounts** for the `badminton-console` project → **Create service
     account** (e.g. `backup-reader`) with the role **Cloud Datastore Viewer** (read-only).
  2. That account → **Keys** → **Add key** → JSON. Keep the file private.
  3. GitHub → the repository → Settings → Secrets and variables → Actions → **New repository secret** named
     `FIREBASE_SERVICE_ACCOUNT`, with the whole JSON file as its value. Delete the downloaded file afterwards.

  Until the secret exists the workflow just says so and does nothing. **Run workflow** on the Actions tab tries it at once.

## Signing in from the iPhone home-screen app

Safari blocks the usual Google sign-in hand-over when the sign-in page is on a different domain from the app. The app
already forwards `/__/auth/…` to Firebase (see `vercel.json`); to use it:

1. Vercel → Project → Settings → Environment Variables: set `VITE_FIREBASE_AUTH_DOMAIN` to the site's own domain
   (`badminton-self.vercel.app`) and redeploy.
2. Google Cloud console → APIs & Services → **Credentials** → the OAuth client Firebase created ("Web client") →
   **Authorized redirect URIs** → add `https://badminton-self.vercel.app/__/auth/handler`.

## Free-tier budget

- **Reads.** A visit reads the player list plus a few documents. All-time stats come from one compact summary
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
| `npm run vercel-build` | What Vercel runs: lint, unit tests, then the build |
| `npm run lint` | ESLint |

## Project layout

```
src/lib/engine/      Pure logic: stats, report, takeaways, scheduler, scoring, rally stats, ratings, seasons,
                     milestones, insights, tournament matches (+ tests, fixtures from the PDFs)
src/lib/data/        Firebase listeners (DataProvider, AuthProvider, useSession) and all writes (mutations/, by area)
src/components/      UI: session (court, matches, report tabs), scorer, report (web + PDF), stats, tournament, ui primitives
src/pages/           Home, Play (sessions + tournaments), New session, Session, session and tournament match pages
                     (live scorer / summary), Tournament, Leaderboard, Players, Player, Me, Admin
firestore.rules      Public read; admins write everything, linked players only their own profile and RSVP,
                     signed-in people only their own "This is me" request
scripts/backup/      The nightly backup (run by GitHub Actions)
.github/workflows/   Checks on every push and pull request; the nightly backup
```

## Notes on the original reports

The four original PDFs are reproduced exactly by `src/lib/engine/report.test.ts`, with two exceptions found while
checking them. The old *Saturday* report printed **434** total points and the old *Sunday* report **390**, but their own
match logs add up to **445** and **401** (every standings row agrees with the corrected totals).
