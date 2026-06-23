<template>
  <div class="scorecard-frame">
    <table
      class="scorecard"
      :class="{ 'scorecard-compact': players.length >= 5 }"
    >
      <thead>
        <tr>
          <th
            class="sticky"
            style="left: 0; text-align: left"
            :class="{ 'scorecard-sort-active-header': sortColumn === 'name' }"
            :aria-sort="ariaSortFor('name')"
            scope="col"
          >
            <button type="button" class="sort-btn" :aria-label="$t('Scorecard.SortByName')" @click="$emit('sort', 'name')">
              {{ $t('General.Player') }}
              <ChevronUpIcon v-if="sortColumn === 'name' && sortDirection === 'asc'" class="sort-ico" />
              <ChevronDownIcon v-else-if="sortColumn === 'name'" class="sort-ico" />
            </button>
          </th>

          <th v-for="hole in holes" :key="hole" scope="col">{{ hole }}</th>

          <th
            scope="col"
            class="scorecard-metric-highlight"
            :class="{ 'scorecard-sort-active-header': sortColumn === 'average' }"
            :aria-sort="ariaSortFor('average')"
          >
            <button type="button" class="sort-btn" :aria-label="$t('Scorecard.SortByAverage')" @click="$emit('sort', 'average')">
              Ø
              <ChevronUpIcon v-if="sortColumn === 'average' && sortDirection === 'asc'" class="sort-ico" />
              <ChevronDownIcon v-else-if="sortColumn === 'average'" class="sort-ico" />
            </button>
          </th>

          <th
            scope="col"
            class="scorecard-metric-highlight"
            :class="{ 'scorecard-sort-active-header': sortColumn === 'total' }"
            :aria-sort="ariaSortFor('total')"
          >
            <button type="button" class="sort-btn" :aria-label="$t('Scorecard.SortByTotal')" @click="$emit('sort', 'total')">
              {{ $t('General.Total') }}
              <ChevronUpIcon v-if="sortColumn === 'total' && sortDirection === 'asc'" class="sort-ico" />
              <ChevronDownIcon v-else-if="sortColumn === 'total'" class="sort-ico" />
            </button>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="player in sortedPlayers"
          :key="player.id"
          class="scorecard-hover-row"
          :style="{ '--player-accent': colorMap[player.id]?.color }"
        >
          <td
            class="sticky scorecard__player-cell"
            style="left: 0; text-align: left"
            :class="{ 'scorecard-sort-active': sortColumn === 'name' }"
          >
            <span class="scorecard__player-name">
              <span class="scorecard__player-dot" :style="{ background: colorMap[player.id]?.color }"></span>
              {{ player.name }}
            </span>
          </td>

          <td
            v-for="hole in holes"
            :key="hole"
            :class="getHeatmapClass(player.id, hole)"
          >{{ scores[player.id]?.[hole] ?? '–' }}</td>

          <td
            class="scorecard-metric-highlight"
            :class="{ 'scorecard-sort-active': sortColumn === 'average' }"
          >{{ averageScore(player.id) }}</td>

          <td
            class="scorecard-metric-highlight scorecard__total"
            :class="{ 'scorecard-sort-active': sortColumn === 'total' }"
          >{{ totalScore(player.id) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/vue/16/solid'
import type { Player } from '@/services/api'
import type { ScoreMap } from '@/types'
import { usePlayerColors } from '@/composables/usePlayerColors'
import { heatmapClass } from '@/utils/scoreHeatmap'

defineEmits<{
  sort: [column: 'name' | 'total' | 'average']
}>()

const props = defineProps<{
  players: Player[]
  holes: number[]
  scores: ScoreMap
  sortColumn: string
  sortDirection: string
  sortedPlayers: Player[]
  averageScore: (playerId: string) => string
  totalScore: (playerId: string) => number
}>()

const { colorMap } = usePlayerColors(computed(() => props.players))
const playerIds = computed(() => props.players.map(p => p.id))

function getHeatmapClass(playerId: string, hole: number): string {
  return heatmapClass(playerId, hole, props.scores, playerIds.value)
}

function ariaSortFor(column: 'name' | 'total' | 'average'): 'ascending' | 'descending' | 'none' {
  if (props.sortColumn !== column) return 'none'
  return props.sortDirection === 'asc' ? 'ascending' : 'descending'
}
</script>

<style scoped>
.scorecard-frame {
  position: relative;
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100dvh - 14rem);
  border-radius: var(--radius-lg);
}

.scorecard { min-width: 42rem; }

.sort-btn {
  background: transparent;
  border: 0;
  padding: 0.3rem 0.45rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: var(--radius-sm);
}
.sort-btn:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.sort-ico {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  margin-left: 0.2rem;
  color: var(--primary);
  vertical-align: -2px;
}


.scorecard__player-cell {
  position: relative;
  font-weight: 600;
}

.scorecard__player-cell::before {
  content: "";
  position: absolute;
  left: 0; top: 15%; bottom: 15%;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--player-accent, var(--primary));
}

.scorecard__player-name {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-strong);
}

.scorecard__player-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
}

.scorecard__total { font-weight: 700; }
</style>
