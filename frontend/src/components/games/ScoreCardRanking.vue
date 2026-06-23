<template>
  <div class="ranking">
    <!-- Podium — immer basierend auf Total (niedrigster = Gewinner) -->
    <section v-if="leaders.length > 0" class="podium" :data-count="leaders.length">
      <div
        v-for="(idx) in podiumOrder"
        :key="leaders[idx]?.id || `empty-${idx}`"
        :class="['podium__pillar', `podium__pillar--rank-${idx + 1}`, !leaders[idx] && 'is-empty']"
      >
        <template v-if="leaders[idx]">
          <div class="podium__medal">
            <MedalBadge :rank="toMedalRank(idx + 1)" :size="44" />
          </div>
          <PlayerAvatar
            :name="leaders[idx].name"
            :color="colorMap[leaders[idx].id]?.color"
            :size="idx === 0 ? 'xl' : 'lg'"
            ringed
          />
          <span class="podium__name" :title="leaders[idx].name">
            {{ leaders[idx].name }}
          </span>
          <span class="podium__total">{{ totalScore(leaders[idx].id) }}</span>
          <span class="podium__avg">Ø {{ averageScore(leaders[idx].id) }}</span>
        </template>
      </div>
    </section>

    <!-- Sortierung: im Ranking nur Ø und Total sinnvoll -->
    <header class="ranking__header">
      <SegmentedControl
        :model-value="effectiveSort"
        :options="sortOptions"
        :label="$t('Scorecard.SortByTotal')"
        @update:model-value="handleSort"
      />
      <button
        type="button"
        class="ranking__direction"
        :aria-label="sortDirection === 'asc' ? $t('Scorecard.SortByTotal') : $t('Scorecard.SortByAverage')"
        @click="$emit('sort', effectiveSort)"
      >
        <ArrowUpIcon v-if="sortDirection === 'asc'" class="w-4 h-4" />
        <ArrowDownIcon v-else class="w-4 h-4" />
      </button>
    </header>

    <!-- Volle Rangliste — Medaillen basieren auf tatsächlichem Rang, nicht auf Sortier-Position -->
    <ol class="ranking__list">
      <li
        v-for="player in sortedPlayers"
        :key="player.id"
        :class="['ranking__item', rankClass(player.id)]"
        :style="{ '--player-accent': colorMap[player.id]?.color }"
      >
        <div class="ranking__rank">
          <MedalBadge
            v-if="rankOf(player.id) <= 2"
            :rank="toMedalRank(rankOf(player.id) + 1)"
            :size="28"
          />
          <span v-else class="ranking__position">{{ rankOf(player.id) + 1 }}</span>
        </div>

        <PlayerAvatar
          :name="player.name"
          :color="colorMap[player.id]?.color"
          size="sm"
        />

        <div class="ranking__names">
          <div class="ranking__name" :title="player.name">{{ player.name }}</div>
          <div class="ranking__meta">Ø {{ averageScore(player.id) }}</div>
        </div>

        <div class="ranking__total">{{ totalScore(player.id) }}</div>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/vue/24/outline'
import type { Player } from '@/services/api'
import { usePlayerColors } from '@/composables/usePlayerColors'
import PlayerAvatar from '@/components/ui/PlayerAvatar.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import MedalBadge from '@/components/ui/MedalBadge.vue'

const emit = defineEmits<{
  sort: [column: 'name' | 'total' | 'average']
}>()

const props = defineProps<{
  sortColumn: string
  sortDirection: string
  sortedPlayers: Player[]
  averageScore: (playerId: string) => string
  totalScore: (playerId: string) => number
}>()

const { t } = useI18n()
const { colorMap } = usePlayerColors(computed(() => props.sortedPlayers))

/** Wahre Rangliste nach Total ascending, unabhängig vom sortColumn. */
const leaders = computed<Player[]>(() =>
  [...props.sortedPlayers].sort(
    (a, b) => props.totalScore(a.id) - props.totalScore(b.id)
  )
)

/** Map playerId → Rang-Index (0 = Sieger). */
const rankByPlayerId = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  leaders.value.forEach((p, i) => {
    map[p.id] = i
  })
  return map
})

function rankOf(playerId: string): number {
  return rankByPlayerId.value[playerId] ?? 99
}

function rankClass(playerId: string): string {
  const r = rankOf(playerId)
  if (r === 0) return 'ranking-row-gold'
  if (r === 1) return 'ranking-row-silver'
  if (r === 2) return 'ranking-row-bronze'
  return ''
}

/** Template-Helper: verpackt die TS-Union in einen Funktionsaufruf, damit
 *  vue-eslint-parser den `|`-Operator nicht als deprecated filter liest. */
function toMedalRank(n: number): 1 | 2 | 3 {
  return (n as 1 | 2 | 3)
}

// Podium: Silber (1) links, Gold (0) mittig, Bronze (2) rechts.
const podiumOrder = computed(() => {
  const count = leaders.value.length
  if (count === 0) return []
  if (count === 1) return [0]
  if (count === 2) return [1, 0]
  return [1, 0, 2]
})

/** Im Ranking-View nur Ø / Total zulassen. Name wäre unsinnig. */
const effectiveSort = computed<'average' | 'total'>(() =>
  props.sortColumn === 'average' ? 'average' : 'total'
)

const sortOptions = computed(() => [
  { value: 'total' as const, label: t('General.Total') },
  { value: 'average' as const, label: 'Ø' },
])

function handleSort(col: 'average' | 'total') {
  if (props.sortColumn !== col) emit('sort', col)
}

// Wenn das Ranking geöffnet wird und der aktuelle Sort 'name' ist,
// automatisch auf 'total' wechseln — das ist hier die sinnvolle Default-Sicht.
onMounted(() => {
  if (props.sortColumn === 'name') emit('sort', 'total')
})
</script>

<style scoped>
.ranking {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Podium */
.podium {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 0.6rem;
  align-items: end;
  padding: 1.25rem 0.75rem 0.25rem;
}

.podium[data-count="1"] { grid-template-columns: minmax(0, 20rem); justify-content: center; }
.podium[data-count="2"] { grid-template-columns: 1fr 1fr; }

.podium__pillar {
  --pillar-height: 8rem;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  /* Obere Padding leicht reduziert — SVG-Medaille hängt bereits oben raus,
     zu viel Luft lässt den Pillar wirkungslos aussehen. */
  padding: 1.15rem 0.5rem 1.1rem;
  min-height: var(--pillar-height);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-sm);
  background: color-mix(in oklab, var(--text-default) 8%, var(--card-bg));
  border: 1px solid var(--card-border);
}

.podium__pillar.is-empty { opacity: 0.3; background: transparent; border-style: dashed; }

.podium__pillar--rank-1 {
  --pillar-height: 11rem;
  background: linear-gradient(180deg, color-mix(in oklab, #fde047 28%, var(--card-bg)) 0%, var(--card-bg) 100%);
  box-shadow: var(--shadow-elev-2), 0 0 32px -8px color-mix(in oklab, #fde047 40%, transparent);
}

.podium__pillar--rank-2 {
  --pillar-height: 9rem;
  background: linear-gradient(180deg, color-mix(in oklab, #d1d5db 28%, var(--card-bg)) 0%, var(--card-bg) 100%);
}

.podium__pillar--rank-3 {
  --pillar-height: 7.5rem;
  background: linear-gradient(180deg, color-mix(in oklab, #d97706 22%, var(--card-bg)) 0%, var(--card-bg) 100%);
}

.podium__medal {
  position: absolute;
  top: -1.25rem;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.25));
  display: inline-flex;
}

.podium__name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-strong);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.podium__total {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 800;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
}

.podium__pillar--rank-1 .podium__total { font-size: var(--text-4xl); }

.podium__avg {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Header */
.ranking__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding-inline: 0.25rem;
}

.ranking__direction {
  /* Tap-Target min 44px */
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-default);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 150ms, background 150ms;
}
.ranking__direction:hover { color: var(--primary); border-color: var(--primary); }

/* List */
.ranking__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ranking__item {
  --player-accent: var(--color-player-1);
  position: relative;
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.95rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
}

.ranking__item::before {
  content: "";
  position: absolute;
  left: 0; top: 20%; bottom: 20%;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--player-accent);
}

.ranking__rank {
  /* Feste Breite damit alle Ränge optisch an der gleichen Stelle starten —
     egal ob Medaille (Platz 1-3) oder nur Zahl. */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.ranking__position {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.ranking__names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ranking__name {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.ranking__meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.ranking__total {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  min-width: 2.5ch;
  text-align: right;
}
</style>
