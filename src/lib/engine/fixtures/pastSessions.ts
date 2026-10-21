/**
 * The four sessions from the group's original PDF reports, transcribed match by match.
 * Test fixtures: the stats engine must reproduce every number in the reports.
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
  /** Date printed in the report, if any (YYYY-MM-DD). */
  knownDate: string | null;
  pointsToWin: number;
  matches: FixtureMatch[];
}

export const PAST_SESSIONS: PastSessionFixture[] = [
  // Saturday_Badminton_Report.pdf
  {
    key: 'saturday',
    knownDate: null,
    pointsToWin: 21,
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
  },
  // Sunday_Badminton_Report.pdf
  {
    key: 'sunday',
    knownDate: null,
    pointsToWin: 21,
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
  },
  // Sunday_Badminton_Report_Oct11.pdf
  {
    key: 'sunday-oct11',
    knownDate: '2026-10-11',
    pointsToWin: 21,
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
  },
  // Sat_Badminton_Report_New.pdf
  {
    key: 'sat-new',
    knownDate: null,
    pointsToWin: 21,
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
  },
];
