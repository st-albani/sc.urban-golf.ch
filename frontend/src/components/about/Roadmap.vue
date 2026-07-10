<template>
  <div class="container-app roadmap">
    <header class="roadmap__header">
      <h1 class="t-headline">{{ $t('About.Roadmap.Title') }}</h1>
      <p class="t-muted">{{ $t('About.Roadmap.Subtitle') }}</p>
    </header>

    <!-- Kombinierter Progress-Block: Balken + lesbare Kennzahl -->
    <section class="roadmap__progress-block">
      <div class="roadmap__progress-head">
        <span class="roadmap__progress-label">{{ $t('About.Roadmap.Status.Progress') }}</span>
        <span class="roadmap__progress-value">
          {{ $t('About.Roadmap.Status.DoneOfTotal', { done: doneCount, total: displayedFeatures.length }) }}
          <span class="roadmap__progress-percent">· {{ donePercent }}%</span>
        </span>
      </div>
      <div
        class="roadmap__progress"
        role="progressbar"
        :aria-valuenow="donePercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="$t('About.Roadmap.Status.Progress')"
      >
        <div class="roadmap__progress-fill" :style="{ width: donePercent + '%' }"></div>
      </div>
    </section>

    <ol class="timeline">
      <li
        v-for="(feature, index) in displayedFeatures"
        :key="feature.key"
        :ref="(el) => observeElement(el as HTMLElement | null, feature.key)"
        :class="['timeline__item appear-container', visibleByKey[feature.key] ? 'appear-visible' : 'appear-hidden']"
        :data-last="index === displayedFeatures.length - 1 ? 'true' : 'false'"
      >
        <span
          class="timeline__marker"
          :class="feature.done && 'is-done'"
          aria-hidden="true"
        >
          <CheckIcon v-if="feature.done" class="w-4 h-4" />
        </span>

        <button
          type="button"
          class="card card--padded card--interactive timeline__card"
          :aria-expanded="expandedByKey[feature.key]"
          @click="toggleExpanded(feature.key)"
        >
          <div class="timeline__card-head">
            <component :is="feature.icon" class="w-5 h-5 timeline__icon" aria-hidden="true" />
            <h3 class="t-subtitle timeline__title">
              {{ $t(`About.Roadmap.Features.${feature.key}.Label`) }}
            </h3>
            <AppBadge
              :variant="feature.done ? 'success' : 'neutral'"
              pill
            >
              {{ feature.done ? $t('About.Roadmap.Status.Done') : $t('About.Roadmap.Status.Planned') }}
            </AppBadge>
          </div>
          <transition name="fade">
            <p v-if="expandedByKey[feature.key]" class="t-body t-muted timeline__desc">
              {{ $t(`About.Roadmap.Features.${feature.key}.Desc`) }}
            </p>
          </transition>
        </button>
      </li>
    </ol>

    <section class="roadmap__cta">
      <div class="cta-card">
        <div class="cta-card__content">
          <h3 class="t-subtitle">
            {{ $t('About.Roadmap.CallToAction.Title') }}
          </h3>
          <p class="t-body t-muted">
            {{ $t('About.Roadmap.CallToAction.Text') }}
          </p>
        </div>
        <AppButton
          variant="primary"
          size="md"
          pill
          tag="router-link"
          to="/feedback"
        >
          {{ $t('About.Roadmap.CallToAction.Link') }}
        </AppButton>
      </div>
    </section>

    <ScrollToTopButton />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, type Component } from 'vue'
import ScrollToTopButton from '@/components/ui/ScrollToTopButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  BeakerIcon,
  BookOpenIcon,
  RocketLaunchIcon,
  GlobeAltIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  UsersIcon,
  ComputerDesktopIcon,
  TrophyIcon,
  MapIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline'

interface Feature { key: string; icon: Component; done: boolean; visible: boolean }

const features: Feature[] = [
  { key: 'TestProd', icon: BeakerIcon, done: true, visible: true },
  { key: 'Documentation', icon: BookOpenIcon, done: true, visible: true },
  { key: 'InitialRelease', icon: RocketLaunchIcon, done: true, visible: true },
  { key: 'OpenSource', icon: GlobeAltIcon, done: true, visible: true },
  { key: 'UserManagement', icon: UserIcon, done: true, visible: true },
  { key: 'CourseManagement', icon: ClipboardDocumentListIcon, done: false, visible: true },
  { key: 'Stats', icon: ChartBarIcon, done: true, visible: true },
  { key: 'DesignImprovements', icon: AdjustmentsHorizontalIcon, done: false, visible: true },
  { key: 'ClubManagement', icon: UsersIcon, done: false, visible: true },
  { key: 'Desktop', icon: ComputerDesktopIcon, done: false, visible: true },
  { key: 'TournamentManagement', icon: TrophyIcon, done: false, visible: false },
  { key: 'TourManagement', icon: MapIcon, done: false, visible: false },
]

const displayedFeatures = computed(() => features.filter(f => f.visible !== false))
const doneCount = computed(() => displayedFeatures.value.filter(f => f.done).length)
const donePercent = computed(() =>
  displayedFeatures.value.length ? Math.round((doneCount.value / displayedFeatures.value.length) * 100) : 0
)

const expandedByKey = reactive<Record<string, boolean>>({})
const visibleByKey = reactive<Record<string, boolean>>({})

for (const f of features) {
  expandedByKey[f.key] = false
  visibleByKey[f.key] = false
}

function toggleExpanded(key: string) {
  expandedByKey[key] = !expandedByKey[key]
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const key = (entry.target as HTMLElement).dataset.featureKey
      if (key) visibleByKey[key] = entry.isIntersecting
    }
  },
  { threshold: 0.1 }
)

const observedElements = new Set<HTMLElement>()
function observeElement(el: HTMLElement | null, key: string) {
  if (el) {
    el.dataset.featureKey = key
    observer.observe(el)
    observedElements.add(el)
  }
}

onMounted(() => {
  nextTick(() => { /* trigger transitions */ })
})

onBeforeUnmount(() => { observer.disconnect(); observedElements.clear() })

void ref
</script>

<style scoped>
.roadmap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-block: 1.25rem 2rem;
}

.roadmap__header > * + * { margin-top: 0.35rem; }

/* Progress-Block */
.roadmap__progress-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.85rem 1rem 0.95rem;
  border-radius: var(--radius-md);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}

.roadmap__progress-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}

.roadmap__progress-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.roadmap__progress-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

.roadmap__progress-percent {
  color: var(--text-muted);
  font-weight: 500;
  margin-left: 0.25rem;
}

/* Fortschritts-Balken */
.roadmap__progress {
  position: relative;
  width: 100%;
  height: 0.55rem;
  border-radius: 999px;
  background: color-mix(in oklab, var(--text-default) 10%, transparent);
  overflow: hidden;
}

.roadmap__progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%);
  border-radius: inherit;
  transition: width 800ms var(--ease-emphasize);
}

/* Timeline */
.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline::before {
  content: "";
  position: absolute;
  left: 0.95rem;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 2px;
  background: var(--divider);
}

.timeline__item {
  position: relative;
  padding-left: 2.5rem;
  transition: opacity 600ms var(--ease-standard), transform 600ms var(--ease-standard);
}

.appear-container { }
.appear-hidden { opacity: 0; transform: translateY(12px); }
.appear-visible { opacity: 1; transform: translateY(0); }

.timeline__marker {
  position: absolute;
  left: 0.2rem;
  top: 0.95rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: var(--card-bg);
  border: 2px solid var(--divider);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.timeline__marker.is-done {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-ink);
}

.timeline__card {
  width: 100%;
  text-align: left;
  cursor: pointer;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-strong);
}

.timeline__card-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.timeline__icon {
  color: var(--primary);
  flex-shrink: 0;
}

.timeline__title {
  flex: 1 1 auto;
  font-size: var(--text-base);
  min-width: 0;
}

.timeline__desc { margin-top: 0.6rem; }

.roadmap__cta { }

.cta-card {
  background: linear-gradient(140deg, color-mix(in oklab, var(--primary) 18%, var(--card-bg)) 0%, var(--card-bg) 70%);
  border: 1px solid color-mix(in oklab, var(--primary) 24%, var(--card-border));
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.cta-card__content > * + * { margin-top: 0.25rem; }

@media (min-width: 560px) {
  .cta-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
  }
}
</style>
