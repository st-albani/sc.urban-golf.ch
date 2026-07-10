<template>
  <DefaultLayout>
    <template v-if="!hasValidGameId">
      <GamesListCompact />
    </template>

    <template v-else>
      <div class="container-app games-detail">
        <ErrorState v-if="error" :message="error" :on-retry="reload" />
        <GamesHoleView v-else-if="isHoleView" />

        <template v-else>
          <header class="games-detail__header">
            <div class="games-detail__title-row">
              <h1 class="t-title games-detail__title" :title="gameName">
                {{ displayName }}
              </h1>
              <div class="games-detail__title-actions">
                <AppIconButton
                  :label="$t('Share.Title')"
                  variant="outline"
                  size="md"
                  @click="shareOpen = true"
                >
                  <ShareIcon class="w-5 h-5" />
                </AppIconButton>
                <AppIconButton
                  :label="$t('Games.HoleView.EditGame')"
                  variant="outline"
                  size="md"
                  @click="$router.push(`/games/new/${gameId}`)"
                >
                  <PencilSquareIcon class="w-5 h-5" />
                </AppIconButton>
              </div>
            </div>

            <!-- Direkter Loch-Zugriff: Chip-Leiste zum Springen in die Hole-View. -->
            <div v-if="holes.length" class="games-detail__holes scroll-hide" role="list">
              <router-link
                v-for="n in holes"
                :key="n"
                :to="`/games/${gameId}/${n}`"
                :class="['games-detail__hole-chip', {
                  'is-partial': holeState(n) === 'partial',
                  'is-complete': holeState(n) === 'complete',
                }]"
                :aria-label="pillAriaLabel(n)"
                role="listitem"
              >
                {{ n }}
                <CheckIcon v-if="holeState(n) === 'complete'" class="games-detail__hole-check" aria-hidden="true" />
              </router-link>
              <router-link
                :to="`/games/${gameId}/${nextNewHole}`"
                class="games-detail__hole-chip games-detail__hole-chip--add"
                :aria-label="$t('General.Hole') + ' +1'"
              >
                <PlusIcon class="w-3.5 h-3.5" />
              </router-link>
            </div>
          </header>

          <ScoreCard />
        </template>

        <ShareGameSheet v-model="shareOpen" :game-id="gameId" :game-name="gameName" />
      </div>
    </template>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import GamesListCompact from '@/components/games/GamesListCompact.vue'
import ScoreCard from '@/components/games/ScoreCard.vue'
import GamesHoleView from '@/components/games/GamesHoleView.vue'
import ShareGameSheet from '@/components/games/ShareGameSheet.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'

import { PencilSquareIcon, PlusIcon, CheckIcon, ShareIcon } from '@heroicons/vue/24/outline'
import { computed, provide, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { useGamesDetailData } from '@/composables/useGamesDetailData'
import { useHoleCompletion } from '@/composables/useHoleCompletion'
import { gamesDetailKey } from '@/types'
import { shortGameName } from '@/utils/format'
import { VALIDATION } from '@/constants'

const route = useRoute()
const { t } = useI18n()
const shareOpen = ref(false)
const gameId = computed(() => route.params.gameId as string)
const hasValidGameId = computed(() =>
  typeof gameId.value === 'string' && /^[a-zA-Z0-9_-]{10,30}$/.test(gameId.value)
)
const isHoleView = computed(() => 'holeId' in route.params)

const { players, scores, holes, gameName, error, load: loadGamesDetailData } = useGamesDetailData(gameId)

provide(gamesDetailKey, { players, scores, holes, gameName, error, load: loadGamesDetailData })

const { holeState } = useHoleCompletion(players, scores)

/** Beschreibt den Chip-Zustand für Screenreader (nicht nur farblich). */
function pillAriaLabel(holeNum: number) {
  const state = holeState(holeNum)
  if (state === 'complete') return t('Games.HoleView.PillComplete', { n: holeNum })
  if (state === 'partial') return t('Games.HoleView.PillPartial', { n: holeNum })
  return `${t('General.Hole')} ${holeNum}`
}

async function reload() { await loadGamesDetailData() }

const displayName = computed(() => shortGameName(gameName.value))

/** Nächste leere Loch-Position — zeigt bis maximal HOLE_MAX. */
const nextNewHole = computed(() => {
  const max = holes.value.length ? Math.max(...holes.value) : 0
  return Math.min(VALIDATION.HOLE_MAX, max + 1)
})

watchEffect(async () => {
  if (!hasValidGameId.value) return
  await loadGamesDetailData()
})
</script>

<style scoped>
.games-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-block: 1.25rem 1.5rem;
}

.games-detail__header {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.games-detail__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.games-detail__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.games-detail__title-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

/* Hole-Pill-Leiste: direkter Zugriff auf Löcher von allen drei Scorecard-Views */
.games-detail__holes {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-block: 0.15rem 0.35rem;
  scroll-snap-type: x mandatory;
}

.games-detail__hole-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
  padding-inline: 0.75rem;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-default);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--text-sm);
  scroll-snap-align: start;
  flex-shrink: 0;
  transition: transform 120ms var(--ease-spring), background 150ms, color 150ms, border-color 150ms;
}

.games-detail__hole-chip:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.games-detail__hole-chip:active { transform: scale(0.94); }

/* Teilweise erfasst: mindestens ein, aber nicht alle Spieler. */
.games-detail__hole-chip.is-partial {
  color: var(--primary);
  background: color-mix(in oklab, var(--primary) 12%, var(--card-bg));
  border-color: color-mix(in oklab, var(--primary) 22%, var(--card-border));
}

/* Vollständig für alle Spieler: Success-Tint + Häkchen (nicht nur farblich). */
.games-detail__hole-chip.is-complete {
  color: color-mix(in oklab, var(--color-success-600) 85%, var(--text-strong));
  background: color-mix(in oklab, var(--color-success-500) 16%, var(--card-bg));
  border-color: color-mix(in oklab, var(--color-success-500) 32%, var(--card-border));
  padding-inline: 0.55rem 0.5rem;
}

:root.dark .games-detail__hole-chip.is-complete {
  color: var(--color-success-400);
}

.games-detail__hole-check {
  width: 0.95rem;
  height: 0.95rem;
  margin-left: 0.15rem;
  flex-shrink: 0;
  stroke-width: 2.5;
}

.games-detail__hole-chip--add {
  color: var(--text-muted);
  background: color-mix(in oklab, var(--text-default) 6%, transparent);
  border-style: dashed;
}
</style>
