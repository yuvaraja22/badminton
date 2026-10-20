/**
 * The four sessions from the group's original PDF reports, transcribed match by match.
 * Used as test fixtures (the stats engine must reproduce the reports) and by Admin → Import.
 */
export interface FixtureMatch {
  t1: [string, string];
  s1: number;
  s2: number;
  t2: [string, string];
  unfinished?: boolean;
}

export interface PastSessionFixture {
  key: string;
  /** Original PDF file name. */
  file: string;
  /** Date printed in the report, if any (YYYY-MM-DD). */
  knownDate: string | null;
  /** Weekday named in the file name / header. */
  weekdayHint: string;
  pointsToWin: number;
  players: string[];
  matches: FixtureMatch[];
  /** The report's original takeaways, kept as that session's takeaways on import. */
  takeaways: string[];
}

export const PAST_SESSIONS: PastSessionFixture[] = [
  {
    key: 'saturday',
    file: 'Saturday_Badminton_Report.pdf',
    knownDate: null,
    weekdayHint: 'Saturday',
    pointsToWin: 21,
    players: ['Vikram', 'Vino', 'Yuva', 'Sridhar', 'Arul', 'Anu', 'Shashwin'],
    matches: [
      { t1: ['Yuva', 'Sridhar'], s1: 21, s2: 18, t2: ['Vikram', 'Vino'] },
      { t1: ['Arul', 'Shashwin'], s1: 12, s2: 21, t2: ['Vikram', 'Anu'] },
      { t1: ['Yuva', 'Sridhar'], s1: 21, s2: 16, t2: ['Vino', 'Arul'] },
      { t1: ['Vikram', 'Anu'], s1: 18, s2: 21, t2: ['Shashwin', 'Sridhar'] },
      { t1: ['Vino', 'Vikram'], s1: 21, s2: 17, t2: ['Yuva', 'Arul'] },
      { t1: ['Shashwin', 'Sridhar'], s1: 18, s2: 21, t2: ['Vino', 'Anu'] },
      { t1: ['Yuva', 'Sridhar'], s1: 22, s2: 23, t2: ['Arul', 'Vikram'] },
      { t1: ['Anu', 'Yuva'], s1: 10, s2: 21, t2: ['Vino', 'Shashwin'] },
      { t1: ['Vikram', 'Arul'], s1: 21, s2: 12, t2: ['Anu', 'Sridhar'] },
      { t1: ['Vino', 'Yuva'], s1: 21, s2: 15, t2: ['Arul', 'Shashwin'] },
      { t1: ['Vikram', 'Vino'], s1: 21, s2: 16, t2: ['Anu', 'Sridhar'] },
      { t1: ['Yuva', 'Shashwin'], s1: 17, s2: 21, t2: ['Anu', 'Arul'] },
    ],
    takeaways: [
      'Tournament MVPs: Vikram and Vino dominated the court with 5 wins each, Vikram taking 1st seed on point differential (+22 vs +21).',
      'High offensive power: Vikram averaged 20.4 points per contest; Vino conceded only 16.9 points per game (best defensive rating).',
      'Clutch encounter: Match 7 went to sudden-death extra points, finishing 23-22 in favor of Arul & Vikram over Yuva & Sridhar.',
    ],
  },
  {
    key: 'sunday',
    file: 'Sunday_Badminton_Report.pdf',
    knownDate: null,
    weekdayHint: 'Sunday',
    pointsToWin: 21,
    players: ['Vikram', 'Shashwin', 'Yuva', 'Anu', 'Uppli', 'Sridhar', 'Vino'],
    matches: [
      { t1: ['Vikram', 'Anu'], s1: 21, s2: 10, t2: ['Sridhar', 'Vino'] },
      { t1: ['Yuva', 'Vikram'], s1: 21, s2: 19, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Yuva', 'Vino'], s1: 15, s2: 21, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Anu', 'Vino'], s1: 16, s2: 21, t2: ['Vikram', 'Shashwin'] },
      { t1: ['Vikram', 'Yuva'], s1: 21, s2: 12, t2: ['Sridhar', 'Uppli'] },
      { t1: ['Anu', 'Uppli'], s1: 20, s2: 22, t2: ['Yuva', 'Shashwin'] },
      { t1: ['Yuva', 'Sridhar'], s1: 18, s2: 21, t2: ['Anu', 'Vikram'] },
      { t1: ['Uppli', 'Sridhar'], s1: 19, s2: 21, t2: ['Vikram', 'Shashwin'] },
      { t1: ['Yuva', 'Anu'], s1: 21, s2: 17, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Yuva', 'Anu'], s1: 8, s2: 21, t2: ['Vikram', 'Uppli'] },
      { t1: ['Vikram', 'Uppli'], s1: 21, s2: 15, t2: ['Sridhar', 'Shashwin'] },
    ],
    takeaways: [
      'Flawless Masterclass: Vikram recorded an extraordinary 8-0 clean sweep, partnering with 4 different teammates and winning every single match.',
      'Debut Impact: Uppli made a strong debut, pairing lethal synergies with Vikram (+19 in 2 games) and scoring a +6 overall differential.',
      'Overtime Thriller: Match 6 between Yuva & Shashwin and Anu & Uppli pushed into extra points, concluding in a 22-20 nail-biter.',
    ],
  },
  {
    key: 'sunday-oct11',
    file: 'Sunday_Badminton_Report_Oct11.pdf',
    knownDate: '2026-10-11',
    weekdayHint: 'Sunday',
    pointsToWin: 21,
    players: ['Sridhar', 'Vikram', 'Anu', 'Shashwin', 'Hardesh', 'Yuva'],
    matches: [
      { t1: ['Yuva', 'Vikram'], s1: 21, s2: 14, t2: ['Anu', 'Hardesh'] },
      { t1: ['Hardesh', 'Shashwin'], s1: 17, s2: 21, t2: ['Vikram', 'Sridhar'] },
      { t1: ['Yuva', 'Anu'], s1: 18, s2: 21, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Hardesh', 'Yuva'], s1: 17, s2: 21, t2: ['Anu', 'Vikram'] },
      { t1: ['Yuva', 'Vikram'], s1: 19, s2: 21, t2: ['Hardesh', 'Sridhar'] },
      { t1: ['Anu', 'Sridhar'], s1: 21, s2: 12, t2: ['Shashwin', 'Hardesh'] },
      { t1: ['Anu', 'Yuva'], s1: 14, s2: 21, t2: ['Shashwin', 'Vikram'] },
      { t1: ['Vikram', 'Yuva'], s1: 21, s2: 23, t2: ['Sridhar', 'Hardesh'] },
      { t1: ['Hardesh', 'Shashwin'], s1: 11, s2: 21, t2: ['Anu', 'Vikram'] },
      { t1: ['Anu', 'Sridhar'], s1: 21, s2: 15, t2: ['Yuva', 'Shashwin'] },
      { t1: ['Yuva', 'Hardesh'], s1: 20, s2: 22, t2: ['Sridhar', 'Vikram'] },
      { t1: ['Anu', 'Vikram'], s1: 21, s2: 19, t2: ['Shashwin', 'Sridhar'] },
    ],
    takeaways: [
      'Sridhar Tops the Table: Sridhar went 7-1 (87.5%), winning with 4 different partners. His only loss was M12 (19-21) alongside Shashwin.',
      "Vikram's Consistency: Vikram also won 7 games (7-2) and posted the best point difference at +32. Both of his losses came alongside Yuva, by 2 points each.",
      'Unbeaten Pairs: Anu & Vikram went 3-0 (+16), and four other pairings finished unbeaten, led by Anu & Sridhar (2-0, +15).',
      'Nail-Biters: Four games were decided by 2 points (M5, M8, M11, M12). M8 (23-21) and M11 (22-20) both went past 21.',
      'Close Calls for Yuva: Yuva finished 1-7, but 3 of those losses were by just 2 points (M5, M8, M11).',
      'Tough Pairing: Hardesh & Shashwin lost all 3 games together (-23).',
    ],
  },
  {
    key: 'sat-new',
    file: 'Sat_Badminton_Report_New.pdf',
    knownDate: null,
    weekdayHint: 'Saturday',
    pointsToWin: 21,
    players: ['Vikram', 'Yuva', 'Shashwin', 'Anu', 'Sridhar'],
    matches: [
      { t1: ['Yuva', 'Vikram'], s1: 21, s2: 16, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Vikram', 'Anu'], s1: 21, s2: 18, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Yuva', 'Sridhar'], s1: 21, s2: 19, t2: ['Anu', 'Vikram'] },
      { t1: ['Yuva', 'Anu'], s1: 17, s2: 21, t2: ['Vikram', 'Shashwin'] },
      { t1: ['Yuva', 'Anu'], s1: 21, s2: 14, t2: ['Sridhar', 'Shashwin'] },
      { t1: ['Sridhar', 'Yuva'], s1: 14, s2: 21, t2: ['Vikram', 'Shashwin'] },
      { t1: ['Vikram', 'Shashwin'], s1: 21, s2: 19, t2: ['Anu', 'Sridhar'] },
      { t1: ['Vikram', 'Yuva'], s1: 21, s2: 9, t2: ['Anu', 'Sridhar'] },
      { t1: ['Yuva', 'Anu'], s1: 23, s2: 25, t2: ['Vikram', 'Shashwin'] },
      { t1: ['Sridhar', 'Shashwin'], s1: 8, s2: 21, t2: ['Yuva', 'Vikram'] },
      { t1: ['Anu', 'Vikram'], s1: 17, s2: 20, t2: ['Yuva', 'Sridhar'], unfinished: true },
    ],
    takeaways: [
      'Near-Flawless Display: Vikram went 8-1 across 9 games, partnering 3 different teammates. His only loss was M3 (19-21) to Yuva & Sridhar.',
      'Unbeaten Pairs: Vikram & Shashwin (4-0, +15) and Vikram & Yuva (3-0, +30) won every game they played together.',
      'Overtime Thriller: M9 went past 21, with Vikram & Shashwin edging Yuva & Anu 25-23.',
      "Yuva's Climb: Yuva finished second at 5-3 (+26), winning with 3 different partners.",
      "Shashwin's Two Sides: Shashwin & Sridhar lost all 4 games as a pair (-28), while Shashwin won all 4 games alongside Vikram.",
      'Unfinished: M11 was stopped with Yuva & Sridhar leading Anu & Vikram 20-17 and is not counted in the standings.',
    ],
  },
];
