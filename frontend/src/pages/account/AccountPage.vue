<template>
  <DefaultLayout>
    <div class="container-app account">
      <header class="account__header">
        <h1 class="t-headline">{{ $t('Stats.Title') }}</h1>
      </header>

      <!-- Nicht eingeloggt -->
      <div v-if="!auth.isLoggedIn" class="account__gate card card--padded">
        <p class="t-body t-muted">{{ $t('Stats.SignInPrompt') }}</p>
        <AppButton variant="primary" size="lg" pill @click="auth.openLogin()">
          {{ $t('Auth.SignInCta') }}
        </AppButton>
      </div>

      <template v-else>
        <p v-if="loading" class="account__hint">{{ $t('Scorecard.Loading') }}</p>

        <template v-else-if="stats && stats.rounds > 0">
          <section class="account__stats">
            <div class="stat-tile">
              <span class="stat-tile__value">{{ stats.rounds }}</span>
              <span class="stat-tile__label">{{ $t('Stats.Rounds') }}</span>
            </div>
            <div class="stat-tile">
              <span class="stat-tile__value">{{ fmt(stats.overallAvg) }}</span>
              <span class="stat-tile__label">{{ $t('Stats.Average') }}</span>
            </div>
            <div class="stat-tile">
              <span class="stat-tile__value">{{ pct(stats.winRate) }}</span>
              <span class="stat-tile__label">{{ $t('Stats.WinRate') }}</span>
            </div>
            <div class="stat-tile">
              <span class="stat-tile__value">{{ fmt(stats.bestRoundAvg) }}</span>
              <span class="stat-tile__label">{{ $t('Stats.Best') }}</span>
            </div>
            <div class="stat-tile">
              <span class="stat-tile__value">{{ fmt(stats.worstRoundAvg) }}</span>
              <span class="stat-tile__label">{{ $t('Stats.Worst') }}</span>
            </div>
            <div class="stat-tile">
              <span class="stat-tile__value">{{ stats.wins }}</span>
              <span class="stat-tile__label">{{ $t('Stats.Wins') }}</span>
            </div>
          </section>

          <section v-if="stats.trend.length > 1" class="account__trend card card--padded">
            <h2 class="t-eyebrow">{{ $t('Stats.Trend') }}</h2>
            <svg class="trend" :viewBox="`0 0 ${trendW} ${trendH}`" preserveAspectRatio="none" role="img" :aria-label="$t('Stats.Trend')">
              <polyline :points="trendPoints" class="trend__line" fill="none" />
              <circle v-for="(p, i) in trendXY" :key="i" :cx="p.x" :cy="p.y" r="2.5" class="trend__dot" />
            </svg>
          </section>
        </template>

        <p v-else class="account__hint">{{ $t('Stats.Empty') }}</p>
      </template>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { fetchStats, type Stats } from '@/services/api'

const auth = useAuthStore()
const stats = ref<Stats | null>(null)
const loading = ref(false)

function fmt(n: number | null): string {
  return n === null ? '–' : n.toFixed(2)
}
function pct(n: number | null): string {
  return n === null ? '–' : `${Math.round(n * 100)}%`
}

async function load() {
  if (!auth.isLoggedIn) return
  loading.value = true
  try {
    stats.value = await fetchStats()
  } finally {
    loading.value = false
  }
}

// Trend-Sparkline (niedriger Schnitt = besser = weiter oben).
const trendW = 300
const trendH = 80
const trendXY = computed(() => {
  const t = stats.value?.trend ?? []
  if (t.length < 2) return []
  const avgs = t.map((p) => p.avg)
  const min = Math.min(...avgs)
  const max = Math.max(...avgs)
  const span = max - min || 1
  const pad = 8
  return t.map((p, i) => ({
    x: pad + (i * (trendW - 2 * pad)) / (t.length - 1),
    y: pad + ((p.avg - min) / span) * (trendH - 2 * pad),
  }))
})
const trendPoints = computed(() => trendXY.value.map((p) => `${p.x},${p.y}`).join(' '))

onMounted(load)
watch(() => auth.isLoggedIn, load)
</script>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-block: 1.25rem 2rem;
}

.account__gate {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  align-items: flex-start;
}

.account__hint {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.account__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

@media (max-width: 420px) {
  .account__stats { grid-template-columns: repeat(2, 1fr); }
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.85rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elev-1);
}

.stat-tile__value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

.stat-tile__label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: 600;
}

.account__trend { display: flex; flex-direction: column; gap: 0.6rem; }

.trend {
  width: 100%;
  height: 5rem;
}

.trend__line {
  stroke: var(--primary);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.trend__dot {
  fill: var(--primary);
}
</style>
