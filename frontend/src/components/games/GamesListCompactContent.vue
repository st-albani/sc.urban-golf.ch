<template>
  <div v-if="games.length === 0 && !isLoading && showNoGamesTimeout" class="games-list__empty">
    <div class="games-list__empty-icon">
      <RectangleStackIcon class="w-8 h-8" />
    </div>
    <p class="t-body t-muted">{{ $t('Games.ListGames.NoGamesFound') }}</p>
  </div>

  <ul v-if="games.length === 0 && isLoading" class="games-list">
    <li v-for="n in props.perPage" :key="'skeleton-' + n" class="games-list__item games-list__item--skeleton">
      <div class="games-list__skeleton-text"></div>
      <div class="games-list__skeleton-meta"></div>
    </li>
  </ul>

  <transition-group v-else name="list" tag="ul" class="games-list">
    <li
      v-for="game in games"
      :key="game.id"
      class="games-list__item games-list__item--interactive"
      @click="navigateToGame(game.id)"
      role="button"
      tabindex="0"
      @keydown.enter="navigateToGame(game.id)"
    >
      <div class="games-list__main">
        <h3 class="games-list__title">{{ game.name }}</h3>

        <div class="games-list__meta">
          <span v-if="game.created_at">{{ formatDateCH(game.created_at) }}</span>
          <span v-if="gameMeta[game.id]?.holes?.length" class="games-list__meta-dot" aria-hidden="true">·</span>
          <span v-if="gameMeta[game.id]?.holes?.length">
            {{ holeCountLabel(gameMeta[game.id]!.holes!.length) }}
          </span>
        </div>

        <div class="games-list__players" v-if="gameMeta[game.id]?.players?.length">
          <div class="games-list__avatars">
            <PlayerAvatar
              v-for="(p, idx) in (gameMeta[game.id]!.players || []).slice(0, 5)"
              :key="p.id"
              :name="p.name"
              :color="playerColor(idx)"
              size="xs"
            />
            <span v-if="(gameMeta[game.id]?.players?.length || 0) > 5" class="games-list__more">
              +{{ (gameMeta[game.id]!.players!.length - 5) }}
            </span>
          </div>
          <span class="games-list__leader" v-if="leaderName(game.id)">
            🏆 {{ leaderName(game.id) }}
          </span>
        </div>
      </div>

      <button
        @click.stop="toggleDetails(game.id)"
        class="games-list__chevron"
        :aria-expanded="expandedGameId === game.id"
        :aria-controls="`game-details-${game.id}`"
        :aria-label="game.name"
      >
        <ChevronDownIcon class="w-5 h-5" :class="{ 'is-expanded': expandedGameId === game.id }" />
      </button>

      <transition name="slide-up">
        <div
          v-if="expandedGameId === game.id"
          :id="`game-details-${game.id}`"
          class="games-list__details"
          @click.stop
        >
          <div class="games-list__details-head">
            <span class="t-eyebrow">{{ $t('Games.ListGames.HolesPlayed') }}</span>
            <span class="t-subtitle">{{ gameMeta[game.id]?.holes?.length || 0 }}</span>
          </div>
          <div class="games-list__players-grid">
            <div
              v-for="player in gameMeta[game.id]?.players || []"
              :key="player.id"
              class="games-list__player-row"
            >
              <span class="games-list__player-name">{{ player.name }}</span>
              <span class="games-list__player-stats">
                Ø {{ formatAverage(player.avg) }}
                <span class="games-list__player-divider">·</span>
                Σ {{ player.total ?? '–' }}
              </span>
            </div>
          </div>
        </div>
      </transition>
    </li>
  </transition-group>

  <div ref="target" class="h-8"></div>
  <ScrollToTopButton />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { formatAverage } from '@urban-golf/contract/standings'
import { useGamesSummaryData } from '@/composables/useGamesSummaryData'
import { useInfiniteLoader } from '@/composables/useInfiniteLoader'
import { useRouter } from 'vue-router'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import { RectangleStackIcon } from '@heroicons/vue/24/outline'
import ScrollToTopButton from '@/components/ui/ScrollToTopButton.vue'
import PlayerAvatar from '@/components/ui/PlayerAvatar.vue'
import { formatDateCH } from '@/utils/format'
import type { PlayerWithStats } from '@/services/api'

const router = useRouter()
const { t } = useI18n()

function navigateToGame(id: string) { router.push(`/games/${id}`) }

/** Pluralisierung: vue-i18n v11 (non-legacy) unterstützt kein $tc mehr.
 *  Stattdessen wählen wir den Schlüssel nach count selbst. */
function holeCountLabel(n: number): string {
  return n === 1 ? t('General.HoleOne', { n }) : t('General.HoleMany', { n })
}

const props = defineProps<{
  searchTerm?: string
  perPage?: number
}>()

const expandedGameId = ref<string | null>(null)
const showNoGamesTimeout = ref(false)
const target = ref<HTMLElement | null>(null)

const {
  games,
  playerMap: _playerMap,
  gameMeta,
  loadGames,
  reset,
  hasMore,
} = useGamesSummaryData()

const { loadMore, isLoading } = useInfiniteLoader({
  loadFn: ({ reset: resetFirst = false } = {}) => loadMoreGames({ resetFirst }),
  target,
  hasMore,
})

onMounted(() => { loadMore({ resetFirst: true }) })

let noGamesTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => { if (noGamesTimer) clearTimeout(noGamesTimer) })

const debouncedSearch = useDebounceFn(async () => {
  showNoGamesTimeout.value = false
  await loadMoreGames({ resetFirst: true })
  noGamesTimer = setTimeout(() => { showNoGamesTimeout.value = true }, 10000)
}, 300)

watch(
  () => props.searchTerm,
  () => {
    if (noGamesTimer) clearTimeout(noGamesTimer)
    debouncedSearch()
  },
  { immediate: false }
)

async function loadMoreGames({ resetFirst = false } = {}) {
  if (resetFirst) reset()
  await loadGames({ perPage: props.perPage ?? 10, search: props.searchTerm || '' })
}

function toggleDetails(id: string) {
  expandedGameId.value = expandedGameId.value === id ? null : id
}

const playerColors = [
  'var(--color-player-1)', 'var(--color-player-2)', 'var(--color-player-3)', 'var(--color-player-4)',
  'var(--color-player-5)', 'var(--color-player-6)', 'var(--color-player-7)', 'var(--color-player-8)',
]
function playerColor(idx: number) { return playerColors[idx % playerColors.length] }

function leaderName(gameId: string): string | null {
  const players = (gameMeta.value[gameId]?.players || []).filter(
    (p: PlayerWithStats | unknown): p is PlayerWithStats & { total: number } =>
      typeof (p as PlayerWithStats).total === 'number'
  )
  if (!players.length) return null
  const sorted = [...players].sort((a, b) => a.total - b.total)
  return sorted[0].name
}

// silence unused
void _playerMap
void computed
</script>

<style scoped>
.games-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.games-list__item {
  position: relative;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 1rem 1rem 1rem 1.15rem;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 0.5rem;
  box-shadow: var(--shadow-elev-1);
  transition: box-shadow 150ms, transform 120ms var(--ease-spring);
  cursor: pointer;
}

.games-list__item--interactive:hover { box-shadow: var(--shadow-elev-2); }
.games-list__item--interactive:active { transform: translateY(1px); }

.games-list__item--skeleton {
  min-height: 4.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: color-mix(in oklab, var(--text-default) 5%, var(--card-bg));
}
.games-list__skeleton-text {
  height: 1rem;
  width: 55%;
  background: color-mix(in oklab, var(--text-default) 15%, transparent);
  border-radius: 999px;
}
.games-list__skeleton-meta {
  height: 0.75rem;
  width: 80%;
  background: color-mix(in oklab, var(--text-default) 8%, transparent);
  border-radius: 999px;
}

.games-list__main {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  grid-column: 1;
}

.games-list__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
  line-height: 1.25;
  /* Zweizeilig erlauben statt hart truncaten — Badge ist weg, hier ist jetzt Platz */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  padding-right: 0.5rem;
}

.games-list__meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.games-list__meta-dot {
  color: color-mix(in oklab, var(--text-muted) 60%, transparent);
}

.games-list__players {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.games-list__avatars {
  display: inline-flex;
}
.games-list__avatars :deep(.avatar) { margin-left: -0.4rem; border: 2px solid var(--card-bg); }
.games-list__avatars :deep(.avatar):first-child { margin-left: 0; }

.games-list__more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding-inline: 0.35rem;
  border-radius: 999px;
  background: color-mix(in oklab, var(--text-default) 10%, transparent);
  color: var(--text-default);
  font-size: 0.65rem;
  font-weight: 700;
  margin-left: -0.4rem;
  border: 2px solid var(--card-bg);
}

.games-list__leader {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.games-list__chevron {
  grid-column: 2;
  align-self: center;
  border: 0;
  background: transparent;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms, color 150ms;
}

.games-list__chevron:hover {
  background: color-mix(in oklab, var(--text-default) 10%, transparent);
  color: var(--text-strong);
}

.games-list__chevron svg { transition: transform 220ms var(--ease-standard); }
.games-list__chevron svg.is-expanded { transform: rotate(180deg); }

.games-list__details {
  grid-column: 1 / -1;
  padding-top: 0.85rem;
  margin-top: 0.25rem;
  border-top: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.games-list__details-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.games-list__players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.4rem 0.9rem;
}

.games-list__player-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: var(--text-sm);
}

.games-list__player-name {
  color: var(--text-strong);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.games-list__player-stats {
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.games-list__player-divider { margin-inline: 0.2rem; }

.games-list__empty {
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
}

.games-list__empty-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--text-default) 8%, transparent);
  color: var(--text-default);
}

.h-8 { height: 2rem; }
</style>
