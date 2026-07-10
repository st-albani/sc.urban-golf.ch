import axios from 'axios'
import { API_ROUTES } from '@/constants'

// ---- Type definitions ----

export interface Player {
  id: string
  name: string
}

export interface PlayerWithStats extends Player {
  avg: number | null
  total: number | null
}

export interface Game {
  id: string
  name: string
  created_at?: string
}

export interface GameSummary extends Game {
  players: PlayerWithStats[] | null
  holes: number[] | null
}

export interface Score {
  id?: number
  game_id: string
  player_id: string
  hole: number
  strokes: number
  player_name?: string
}

export interface GamesListResponse {
  games: Game[]
  total: number
}

export interface GamesSummaryResponse {
  games: GameSummary[]
}

export interface FeedbackPayload {
  rating: number
  message: string
  name?: string
  email?: string
}

// ---- Games ----

export async function fetchGamesSummary(params: {
  page: number
  per_page: number
  search?: string
}): Promise<GamesSummaryResponse> {
  const { data } = await axios.get<GamesSummaryResponse>(API_ROUTES.GAMES_SUMMARY, { params })
  return data
}

export async function fetchGame(gameId: string): Promise<Game> {
  const { data } = await axios.get<Game>(`${API_ROUTES.GAMES}/${gameId}`)
  return data
}

export async function fetchGamePlayers(gameId: string): Promise<Player[]> {
  const { data } = await axios.get<Player[]>(`${API_ROUTES.GAMES}/${gameId}/players`)
  return data
}

export async function createOrUpdateGame(payload: {
  id: string
  name: string
  players: string[]
}): Promise<Game & { status: string }> {
  const { data } = await axios.post(API_ROUTES.GAMES, payload)
  return data
}

// ---- Players ----

export async function createOrUpdatePlayer(payload: {
  id: string
  name: string
}): Promise<Player & { status: string }> {
  const { data } = await axios.post(API_ROUTES.PLAYERS, payload)
  return data
}

export async function createOrUpdatePlayers(
  players: { id: string; name: string }[]
): Promise<(Player & { status: string })[]> {
  return Promise.all(players.map((p) => createOrUpdatePlayer(p)))
}

// ---- Scores ----

export async function fetchScores(gameId: string): Promise<Score[]> {
  const { data } = await axios.get<Score[]>(API_ROUTES.SCORES, {
    params: { game_id: gameId },
  })
  return data
}

export async function saveScore(payload: {
  game_id: string
  player_id: string
  hole: number
  strokes: number
}): Promise<Score> {
  const { data } = await axios.post<Score>(API_ROUTES.SCORES, payload)
  return data
}

// ---- Feedback ----

export async function submitFeedback(payload: FeedbackPayload): Promise<{ success: boolean }> {
  const { data } = await axios.post<{ success: boolean }>(API_ROUTES.FEEDBACK, payload)
  return data
}

// ---- Auth (optionale Identität via E-Mail-OTP) ----

export interface Account {
  id: string
  email: string
  displayName: string | null
}

export async function requestOtp(email: string): Promise<void> {
  await axios.post(`${API_ROUTES.AUTH}/request-otp`, { email })
}

export async function verifyOtp(email: string, code: string): Promise<Account> {
  const { data } = await axios.post<{ account: Account }>(`${API_ROUTES.AUTH}/verify-otp`, { email, code })
  return data.account
}

export async function fetchMe(): Promise<Account | null> {
  try {
    const { data } = await axios.get<{ account: Account }>(`${API_ROUTES.AUTH}/me`)
    return data.account
  } catch {
    // 401 (nicht eingeloggt) wird vom Interceptor still durchgereicht.
    return null
  }
}

export async function logout(): Promise<void> {
  await axios.post(`${API_ROUTES.AUTH}/logout`)
}

export async function setProfile(displayName: string): Promise<{ account: Account; claimedCount: number }> {
  const { data } = await axios.post<{ account: Account; claimedCount: number }>(
    `${API_ROUTES.AUTH}/profile`,
    { displayName },
  )
  return data
}

export async function fetchMyGames(): Promise<GameSummary[]> {
  const { data } = await axios.get<GamesSummaryResponse>(`${API_ROUTES.AUTH}/my-games`)
  return data.games
}

export interface TrendPoint {
  gameId: string
  name: string
  date: string
  avg: number
}

export interface Stats {
  rounds: number
  overallAvg: number | null
  bestRoundAvg: number | null
  worstRoundAvg: number | null
  winRate: number | null
  wins: number
  trend: TrendPoint[]
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await axios.get<Stats>(`${API_ROUTES.AUTH}/stats`)
  return data
}

export interface Opponent {
  name: string
  rounds: number
}

export interface HeadToHead {
  name: string
  shared: number
  wins: number
  losses: number
  ties: number
  myAvg: number | null
  opponentAvg: number | null
}

export async function fetchOpponents(): Promise<Opponent[]> {
  const { data } = await axios.get<{ opponents: Opponent[] }>(`${API_ROUTES.AUTH}/opponents`)
  return data.opponents
}

export async function fetchHeadToHead(name: string): Promise<HeadToHead> {
  const { data } = await axios.get<HeadToHead>(`${API_ROUTES.AUTH}/head-to-head`, { params: { name } })
  return data
}

export interface AccountSummary {
  email: string
  displayName: string | null
  playerNames: string[]
  rounds: number
}

export async function fetchAccountSummary(): Promise<AccountSummary> {
  const { data } = await axios.get<AccountSummary>(`${API_ROUTES.AUTH}/account-summary`)
  return data
}

export async function deleteAccount(keepScores: boolean): Promise<void> {
  await axios.delete(`${API_ROUTES.AUTH}/account`, { params: { keepScores } })
}
