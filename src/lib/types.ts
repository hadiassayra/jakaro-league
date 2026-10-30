export type GroupId = 'A' | 'B';
export const GROUPS: GroupId[] = ['A', 'B'];

export interface Team {
  id: string;
  logo?: string | null;
  pointsAdjustment?: number;
  pointsAdjustmentReason?: string;
  name: string;
  player1: string;
  player2: string;
  group: GroupId | null;
}

export type MatchStatus = 'upcoming' | 'playing' | 'finished';
export type Stage = 'group' | 'knockout';

export interface MatchCards {
  yellow: number;
  red: boolean;
}

export interface MatchResultSnapshot {
  winnerId: string | null;
  loserMarbles: number | null;
  status: MatchStatus;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface Match {
  id: string;
  cards?: Record<string, MatchCards>;
  forfeit?: { teamId: string; prior: MatchResultSnapshot };
  scheduledAt?: number | null;
  playDay?: string | null;
  dayRound?: 1 | 2 | null;
  stage: Stage;
  /** Group matches only */
  group?: GroupId;
  /** Group matches: round number (1-based). Knockout: round index (0 = first knockout round) */
  round: number;
  /** Knockout only: position inside the round (0-based) */
  slot?: number;
  /** Knockout only: true for the 3rd-place match */
  thirdPlace?: boolean;
  table: number | null;
  teamA: string | null;
  teamB: string | null;
  winnerId: string | null;
  /** Marbles the losing team had NOT brought home */
  loserMarbles: number | null;
  status: MatchStatus;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface ThemeColors {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
}

export interface Settings {
  name: string;
  maxMarbles: number;
  qualifiersPerGroup: number;
  thirdPlaceMatch: boolean;
  tablesCount: number;
  rotationSeconds: number;
  matchTimeLimitMin: number;
  logo: string | null;
  /** Colors derived from the logo (or defaults) */
  palette: { primary: string; accent: string };
  /** Manual overrides; null = automatic */
  overrides: Partial<Record<keyof ThemeColors, string>>;
  dark: boolean;
  sound: boolean;
  pinHash: string | null;
  publicBaseUrl: string;
}

export interface LogEntry {
  id: string;
  at: number;
  text: string;
}

export interface Tournament {
  id: string;
  currentPlayDay?: string;
  settings: Settings;
  teams: Team[];
  matches: Match[];
  groupsLocked: boolean;
  /** Manual tie order per group: team ids in preferred order */
  tieOverrides: Record<GroupId, string[]>;
  log: LogEntry[];
  createdAt: number;
  updatedAt: number;
}

export type TiebreakReason = 'points' | 'marbles' | 'h2h' | 'override' | 'unresolved' | 'none';

export interface StandingRow {
  teamId: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  points: number;
  disciplinaryDeduction?: number;
  pointsAdjustment?: number;
  marblePoints: number;
  /** oldest → newest */
  form: ('W' | 'L')[];
  /** How this team's position against its tied neighbours was decided */
  tiebreak: TiebreakReason;
}

export type QualStatus = 'qualified' | 'eliminated' | 'open';
