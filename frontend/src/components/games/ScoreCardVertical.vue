<template>
  <div class="scorecard-frame">
    <table
      class="scorecard"
      :class="{ 'scorecard-compact': players.length >= 5 }"
    >
      <thead>
        <tr>
          <th scope="col" style="text-align: left">{{ $t('General.Hole') }}</th>
          <th
            v-for="player in sortedPlayers"
            :key="player.id"
            scope="col"
            :title="player.name"
          >
            <span class="scorecard__head-player">
              <span class="scorecard__head-dot" :style="{ background: colorMap[player.id]?.color }"></span>
              <span class="scorecard__head-name">{{ player.name }}</span>
            </span>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="hole in holes"
          :key="hole"
          class="scorecard-hover-row"
        >
          <td style="text-align: left; font-weight: 600">{{ hole }}</td>
          <td
            v-for="player in sortedPlayers"
            :key="player.id"
            :class="getHeatmapClass(player.id, hole)"
          >
            {{ scores[player.id]?.[hole] ?? '–' }}
          </td>
        </tr>

        <tr
          class="scorecard-metric-highlight"
          :class="{ 'scorecard-sort-active': sortColumn === 'average' }"
        >
          <td style="text-align: left; font-weight: 700">
            <button type="button" class="sort-btn" :aria-label="$t('Scorecard.SortByAverage')" @click="$emit('sort', 'average')">
              Ø
              <ChevronUpIcon v-if="sortColumn === 'average' && sortDirection === 'asc'" class="sort-ico" />
              <ChevronDownIcon v-else-if="sortColumn === 'average'" class="sort-ico" />
            </button>
          </td>
          <td
            v-for="player in sortedPlayers"
            :key="player.id"
            style="font-weight: 600"
          >{{ averageScore(player.id) }}</td>
        </tr>

        <tr
          class="scorecard-metric-highlight"
          :class="{ 'scorecard-sort-active': sortColumn === 'total' }"
        >
          <td style="text-align: left; font-weight: 700">
            <button type="button" class="sort-btn" :aria-label="$t('Scorecard.SortByTotal')" @click="$emit('sort', 'total')">
              {{ $t('General.Total') }}
              <ChevronUpIcon v-if="sortColumn === 'total' && sortDirection === 'asc'" class="sort-ico" />
              <ChevronDownIcon v-else-if="sortColumn === 'total'" class="sort-ico" />
            </button>
          </td>
          <td
            v-for="player in sortedPlayers"
            :key="player.id"
            style="font-weight: 700"
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

defineEmits<{
  sort: [column: 'name' | 'total' | 'average']
}>()

const { colorMap } = usePlayerColors(computed(() => props.players))
const playerIds = computed(() => props.players.map(p => p.id))

function getHeatmapClass(playerId: string, hole: number): string {
  return heatmapClass(playerId, hole, props.scores, playerIds.value)
}
</script>

<style scoped>
.scorecard-frame {
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100dvh - 14rem);
  border-radius: var(--radius-lg);
}

.scorecard { width: auto; min-width: 100%; }


.scorecard__head-player {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.scorecard__head-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.scorecard__head-name {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-btn {
  background: transparent;
  border: 0;
  padding: 0.25rem 0.4rem;
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
  width: 0.85rem;
  height: 0.85rem;
  margin-left: 0.2rem;
  color: var(--primary);
}
</style>
