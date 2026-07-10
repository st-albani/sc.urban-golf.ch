<template>
  <header class="top-bar">
    <div class="top-bar__inner container-app">
      <div class="top-bar__left">
        <AppIconButton
          v-if="showBack"
          :label="$t('General.Back')"
          variant="ghost"
          size="md"
          @click="goBack"
        >
          <ArrowLeftIcon class="w-5 h-5" />
        </AppIconButton>

        <router-link v-else to="/" class="top-bar__brand" :aria-label="$t('General.BrandHome')">
          <img
            src="/img/web-app-manifest-192x192.png"
            alt=""
            aria-hidden="true"
            width="32"
            height="32"
            class="top-bar__logo"
          />
          <span class="top-bar__wordmark">ScoreCard</span>
        </router-link>
      </div>

      <div class="top-bar__center" v-if="showBack">
        <span v-if="title" class="top-bar__title">{{ title }}</span>
      </div>

      <div class="top-bar__right">
        <span v-if="!isOnline" class="chip chip--live" role="status">
          {{ $t('Network.Offline') }}
        </span>

        <!-- Desktop: quick links -->
        <nav class="top-bar__desktop-nav" :aria-label="$t('General.PrimaryNav')">
          <router-link
            v-for="item in desktopItems"
            :key="item.to"
            :to="item.to"
            class="top-bar__nav-link"
            :class="{ 'is-active': isActive(item.to) }"
          >
            {{ $t(item.label) }}
          </router-link>
        </nav>

        <AppIconButton
          :label="$t('General.Settings')"
          variant="ghost"
          size="md"
          @click="settingsOpen = true"
        >
          <Cog6ToothIcon class="w-5 h-5" />
        </AppIconButton>
      </div>
    </div>

    <SettingsSheet v-model="settingsOpen" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { ArrowLeftIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import SettingsSheet from '@/components/layout/SettingsSheet.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const isOnline = useOnline()

const settingsOpen = ref(false)

const desktopItems = [
  { to: '/games', label: 'General.Games' },
  { to: '/games/new', label: 'General.NewGame' },
  { to: '/about', label: 'About.Title' },
]

const showBack = computed(() => route.path !== '/')

const title = computed(() => {
  const metaTitle = route.meta?.title as string | undefined
  if (!metaTitle) return ''
  if (route.name === 'GamesHole') return `${t('General.Hole')} ${route.params.holeId}`
  if (route.name === 'GamesDetail') return t('General.Scorecard')
  return t(metaTitle)
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: 45;
  background: var(--nav-bg);
  backdrop-filter: saturate(1.4) blur(16px);
  -webkit-backdrop-filter: saturate(1.4) blur(16px);
  border-bottom: 1px solid var(--nav-border);
  padding-top: var(--spacing-safe-top);
}

/* iOS/Low-End-Mobile: Blur ist teuer — opake Fläche schützt Scroll-Performance */
@media (max-width: 480px) {
  .top-bar {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--card-bg);
  }
}

.top-bar__inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  height: 3.5rem;
}

.top-bar__left { display: inline-flex; align-items: center; gap: 0.5rem; min-width: 0; }
.top-bar__right { display: inline-flex; align-items: center; gap: 0.35rem; justify-self: end; }
.top-bar__center { overflow: hidden; min-width: 0; }

.top-bar__title {
  display: block;
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-strong);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.top-bar__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
  color: var(--text-strong);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.top-bar__logo {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  object-fit: cover;
  display: block;
  box-shadow: var(--shadow-elev-1);
}

.top-bar__wordmark {
  font-size: var(--text-lg);
}

.top-bar__desktop-nav {
  display: none;
  gap: 0.35rem;
  align-items: center;
}

@media (min-width: 768px) {
  .top-bar__desktop-nav { display: inline-flex; }
  .top-bar__inner { grid-template-columns: auto 1fr auto; }
}

.top-bar__nav-link {
  display: inline-flex;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-default);
  text-decoration: none;
  transition: background 150ms, color 150ms;
}

.top-bar__nav-link:hover {
  color: var(--text-strong);
  background: color-mix(in oklab, var(--text-default) 8%, transparent);
}

.top-bar__nav-link.is-active {
  background: color-mix(in oklab, var(--primary) 18%, transparent);
  color: var(--primary);
}
</style>
