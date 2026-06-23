<template>
  <div class="scorecard-host">
    <SegmentedControl
      v-model="viewMode"
      :options="viewOptions"
      label="Ansicht"
      block
    />

    <GamesDetailSkeleton v-if="players.length === 0" :rows="4" :columns="6" />

    <div v-else class="scorecard-host__body">
      <Transition name="view-fade" mode="out-in">
        <ScoreCardRanking
          v-if="viewMode === 'ranking'"
          key="ranking"
          :sort-column="sortColumn"
          :sort-direction="sortDirection"
          :sorted-players="sortedPlayers"
          :average-score="averageScore"
          :total-score="totalScore"
          @sort="sortBy"
        />
        <ScoreCardHorizontal
          v-else-if="viewMode === 'horizontal'"
          key="horizontal"
          :players="sortedPlayers"
          :holes="holes"
          :scores="scores"
          :sort-column="sortColumn"
          :sort-direction="sortDirection"
          :sorted-players="sortedPlayers"
          :average-score="averageScore"
          :total-score="totalScore"
          @sort="sortBy"
        />
        <ScoreCardVertical
          v-else
          key="vertical"
          :players="sortedPlayers"
          :holes="holes"
          :scores="scores"
          :sort-column="sortColumn"
          :sort-direction="sortDirection"
          :sorted-players="sortedPlayers"
          :average-score="averageScore"
          :total-score="totalScore"
          @sort="sortBy"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, markRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { TrophyIcon, TableCellsIcon, ListBulletIcon } from '@heroicons/vue/24/outline'

import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import GamesDetailSkeleton from '@/components/games/GamesDetailSkeleton.vue'
import ScoreCardRanking from '@/components/games/ScoreCardRanking.vue'
import ScoreCardHorizontal from '@/components/games/ScoreCardHorizontal.vue'
import ScoreCardVertical from '@/components/games/ScoreCardVertical.vue'

import { useSortedPlayers } from '@/composables/useSortedPlayers'
import { useViewMode } from '@/composables/useViewMode'
import { gamesDetailKey } from '@/types'

const ctx = inject(gamesDetailKey)
if (!ctx) throw new Error('ScoreCard requires gamesDetailKey provider')
const { players, scores, holes } = ctx

const { t } = useI18n()

const { sortColumn, sortDirection, sortedPlayers, totalScore, averageScore } =
  useSortedPlayers(players, scores)

const { viewMode, loadPreference } = useViewMode(players, holes)

const viewOptions = computed(() => [
  { value: 'ranking' as const, label: t('Scorecard.ViewRanking'), icon: markRaw(TrophyIcon) },
  { value: 'horizontal' as const, label: t('Scorecard.ViewHorizontal'), icon: markRaw(TableCellsIcon) },
  { value: 'vertical' as const, label: t('Scorecard.ViewVertical'), icon: markRaw(ListBulletIcon) },
])

function sortBy(column: 'name' | 'total' | 'average') {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

// Load persisted view preference once data is in.
watch(
  () => players.value.length,
  (len) => { if (len > 0) loadPreference() },
  { immediate: true },
)
</script>

<style scoped>
.scorecard-host {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.scorecard-host__body {
  min-height: 6rem;
}
</style>
