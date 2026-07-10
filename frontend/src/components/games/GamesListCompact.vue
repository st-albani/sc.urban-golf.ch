<template>
  <div class="container-app games-list-page">
    <header class="games-list-page__header">
      <div class="games-list-page__title-row">
        <h1 class="t-headline">{{ $t('Games.ListGames.AllGames') }}</h1>
        <AppIconButton
          :label="$t('Join.Title')"
          variant="outline"
          size="md"
          @click="joinOpen = true"
        >
          <QrCodeIcon class="w-5 h-5" />
        </AppIconButton>
      </div>

      <SegmentedControl
        v-if="auth.isLoggedIn"
        v-model="mode"
        :options="modeOptions"
        :label="$t('Games.ListGames.AllGames')"
        block
      />

      <div v-if="mode === 'all'" class="games-list-page__search">
        <span class="games-list-page__search-icon" aria-hidden="true">
          <MagnifyingGlassIcon class="w-5 h-5" />
        </span>
        <input
          type="search"
          v-model="searchTerm"
          :placeholder="$t('Games.ListGames.SearchText')"
          class="field games-list-page__input"
          inputmode="search"
          autocomplete="off"
          :aria-label="$t('Games.ListGames.SearchAria')"
        />
        <button
          v-if="searchTerm"
          @click="searchTerm = ''"
          class="games-list-page__clear"
          :aria-label="$t('Games.ListGames.ClearSearch')"
          type="button"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </header>

    <GamesListMine v-if="mode === 'mine'" />
    <Suspense v-else>
      <template #default>
        <GamesListCompactContent :search-term="searchTerm" :per-page="perPage" />
      </template>
      <template #fallback>
        <div class="games-list-page__fallback">
          {{ $t('Games.ListGames.Loading') }}
        </div>
      </template>
    </Suspense>

    <JoinGameSheet v-model="joinOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GamesListCompactContent from '@/components/games/GamesListCompactContent.vue'
import GamesListMine from '@/components/games/GamesListMine.vue'
import JoinGameSheet from '@/components/games/JoinGameSheet.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { MagnifyingGlassIcon, XMarkIcon, QrCodeIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()

function calculatePerPage(): number {
  const available = typeof window !== 'undefined' ? window.innerHeight - 320 : 600
  return Math.max(6, Math.floor(available / 90))
}

const searchTerm = ref('')
const perPage = ref(calculatePerPage())
const joinOpen = ref(false)
const mode = ref<'all' | 'mine'>('all')
const modeOptions = computed(() => [
  { value: 'all' as const, label: t('Games.ListGames.FilterAll') },
  { value: 'mine' as const, label: t('Games.ListGames.FilterMine') },
])

function handleResize() { perPage.value = calculatePerPage() }

onMounted(() => { window.addEventListener('resize', handleResize) })
onUnmounted(() => { window.removeEventListener('resize', handleResize) })
</script>

<style scoped>
.games-list-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-block: 1.25rem 2.5rem;
}

.games-list-page__header {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.games-list-page__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.games-list-page__search {
  position: relative;
}

.games-list-page__search-icon {
  position: absolute;
  left: 0.95rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.games-list-page__input {
  padding-left: 2.75rem;
  padding-right: 2.5rem;
  padding-block: 0.75rem;
  font-size: var(--text-base);
  border-radius: var(--radius-pill);
}

.games-list-page__clear {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  border: 0;
  background: color-mix(in oklab, var(--text-default) 10%, transparent);
  color: var(--text-default);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms;
}
.games-list-page__clear:hover {
  background: color-mix(in oklab, var(--text-default) 18%, transparent);
  color: var(--text-strong);
}

.games-list-page__fallback {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
