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

          <section v-if="opponents.length" class="account__h2h card card--padded">
            <h2 class="t-eyebrow">{{ $t('Stats.HeadToHead') }}</h2>
            <select v-model="selectedOpponent" class="field account__h2h-select" :aria-label="$t('Stats.PickOpponent')">
              <option value="">{{ $t('Stats.PickOpponent') }}</option>
              <option v-for="o in opponents" :key="o.name" :value="o.name">{{ o.name }} ({{ o.rounds }})</option>
            </select>
            <div v-if="h2h && h2h.shared > 0" class="h2h">
              <div class="h2h__score">
                <span class="h2h__side">{{ $t('Stats.You') }}</span>
                <strong class="h2h__record">{{ h2h.wins }} : {{ h2h.losses }}</strong>
                <span class="h2h__side h2h__side--opp">{{ h2h.name }}</span>
              </div>
              <p class="h2h__meta t-muted">
                {{ h2h.shared }} {{ $t('Stats.SharedRounds') }} · Ø {{ fmt(h2h.myAvg) }} : {{ fmt(h2h.opponentAvg) }}
              </p>
            </div>
          </section>
        </template>

        <p v-else class="account__hint">{{ $t('Stats.Empty') }}</p>

        <section v-if="!loading && summary" class="account__data card card--padded">
          <h2 class="t-eyebrow">{{ $t('Account.DataTitle') }}</h2>
          <dl class="account__data-list">
            <div class="account__data-row">
              <dt>{{ $t('Account.Email') }}</dt>
              <dd>{{ summary.email }}</dd>
            </div>
            <div class="account__data-row">
              <dt>{{ $t('Account.Names') }}</dt>
              <dd>{{ summary.playerNames.join(', ') || '–' }}</dd>
            </div>
            <div class="account__data-row">
              <dt>{{ $t('Account.Rounds') }}</dt>
              <dd>{{ summary.rounds }}</dd>
            </div>
          </dl>

          <div v-if="!confirmDelete">
            <AppButton variant="ghost" size="md" pill @click="confirmDelete = true">
              {{ $t('Account.Delete') }}
            </AppButton>
          </div>
          <div v-else class="account__delete">
            <p class="account__delete-q">{{ $t('Account.DeleteConfirm') }}</p>
            <AppButton variant="secondary" size="md" block pill :loading="deleting" @click="doDelete(true)">
              {{ $t('Account.DeleteKeep') }}
            </AppButton>
            <AppButton variant="danger" size="md" block pill :loading="deleting" @click="doDelete(false)">
              {{ $t('Account.DeleteRemove') }}
            </AppButton>
            <AppButton variant="ghost" size="sm" block pill :disabled="deleting" @click="confirmDelete = false">
              {{ $t('Account.DeleteCancel') }}
            </AppButton>
          </div>
        </section>
      </template>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  fetchStats, fetchOpponents, fetchHeadToHead, fetchAccountSummary,
  type Stats, type Opponent, type HeadToHead, type AccountSummary,
} from '@/services/api'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
const { success } = useToast()
const stats = ref<Stats | null>(null)
const loading = ref(false)
const opponents = ref<Opponent[]>([])
const selectedOpponent = ref('')
const h2h = ref<HeadToHead | null>(null)
const summary = ref<AccountSummary | null>(null)
const confirmDelete = ref(false)
const deleting = ref(false)

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
    opponents.value = await fetchOpponents()
    summary.value = await fetchAccountSummary()
  } finally {
    loading.value = false
  }
}

async function doDelete(keepScores: boolean) {
  if (deleting.value) return
  deleting.value = true
  try {
    await auth.deleteAccount(keepScores)
    success(t('Account.Deleted'))
    router.push('/')
  } finally {
    deleting.value = false
  }
}

watch(selectedOpponent, async (name) => {
  if (!name) {
    h2h.value = null
    return
  }
  h2h.value = await fetchHeadToHead(name)
})

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

.account__h2h {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.account__h2h-select {
  width: 100%;
}

.h2h {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding-top: 0.25rem;
}

.h2h__score {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.h2h__side {
  font-weight: 600;
  color: var(--text-default);
}

.h2h__side--opp { color: var(--text-strong); }

.h2h__record {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

.h2h__meta {
  font-size: var(--text-sm);
}

.account__data {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.account__data-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
}

.account__data-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--text-sm);
}

.account__data-row dt {
  color: var(--text-muted);
  font-weight: 600;
}

.account__data-row dd {
  margin: 0;
  color: var(--text-strong);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account__delete {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.account__delete-q {
  font-size: var(--text-sm);
  color: var(--text-default);
  font-weight: 600;
}
</style>
