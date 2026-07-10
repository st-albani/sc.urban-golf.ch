<template>
  <div class="container-app games-list-page">
    <header class="games-list-page__header">
      <h1 class="t-headline">{{ $t('Games.ListGames.AllGames') }}</h1>

      <div class="games-list-page__search">
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

    <Suspense>
      <template #default>
        <GamesListCompactContent :search-term="searchTerm" :per-page="perPage" />
      </template>
      <template #fallback>
        <div class="games-list-page__fallback">
          {{ $t('Games.ListGames.Loading') }}
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import GamesListCompactContent from '@/components/games/GamesListCompactContent.vue'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'

function calculatePerPage(): number {
  const available = typeof window !== 'undefined' ? window.innerHeight - 320 : 600
  return Math.max(6, Math.floor(available / 90))
}

const searchTerm = ref('')
const perPage = ref(calculatePerPage())

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
