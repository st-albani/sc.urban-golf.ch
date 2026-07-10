<template>
  <div class="mine">
    <p v-if="loading" class="mine__hint">{{ $t('Games.ListGames.Loading') }}</p>
    <p v-else-if="games.length === 0" class="mine__hint">{{ $t('Games.ListGames.NoMyGames') }}</p>
    <ul v-else class="games-list">
      <li
        v-for="g in games"
        :key="g.id"
        class="games-list__item games-list__item--interactive"
        role="button"
        tabindex="0"
        @click="go(g.id)"
        @keydown.enter="go(g.id)"
      >
        <div class="games-list__main">
          <h3 class="games-list__title">{{ g.name }}</h3>
          <div class="games-list__meta">
            <span v-if="g.created_at">{{ formatDateCH(g.created_at) }}</span>
            <span v-if="g.holes?.length" class="games-list__meta-dot" aria-hidden="true">·</span>
            <span v-if="g.holes?.length">{{ holeCountLabel(g.holes.length) }}</span>
            <span v-if="leader(g)" class="games-list__meta-dot" aria-hidden="true">·</span>
            <span v-if="leader(g)" class="mine__leader">🏆 {{ leader(g) }}</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchMyGames, type GameSummary, type PlayerWithStats } from '@/services/api'
import { formatDateCH } from '@/utils/format'

const { t } = useI18n()
const router = useRouter()

const games = ref<GameSummary[]>([])
const loading = ref(true)

function holeCountLabel(n: number): string {
  return n === 1 ? t('General.HoleOne', { n }) : t('General.HoleMany', { n })
}

function leader(game: GameSummary): string | null {
  const players = (game.players || []).filter(
    (p): p is PlayerWithStats & { total: number } => typeof p.total === 'number',
  )
  if (!players.length) return null
  return [...players].sort((a, b) => a.total - b.total)[0].name
}

function go(id: string) {
  router.push(`/games/${id}`)
}

onMounted(async () => {
  try {
    games.value = await fetchMyGames()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.mine {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.mine__hint {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.mine__leader {
  color: var(--text-muted);
  white-space: nowrap;
}

.games-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.games-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elev-1);
  cursor: pointer;
  transition: box-shadow 150ms, transform 120ms var(--ease-spring);
}

.games-list__item:hover { box-shadow: var(--shadow-elev-2); }
.games-list__item:active { transform: translateY(1px); }

.games-list__title {
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-strong);
}

.games-list__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
