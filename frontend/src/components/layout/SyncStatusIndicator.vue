<template>
  <Transition name="sync-status">
    <div
      v-if="visible"
      class="sync-status"
      :class="`sync-status--${tone}`"
      role="status"
      aria-live="polite"
    >
      <component
        :is="icon"
        class="sync-status__icon"
        :class="{ 'sync-status__icon--spin': tone === 'syncing' }"
        aria-hidden="true"
      />
      <span class="sync-status__text">{{ label }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { ArrowPathIcon, SignalSlashIcon } from '@heroicons/vue/24/outline'
import { useSyncQueueStore } from '@/stores/syncQueue'
import { useSyncStatus } from '@/composables/useSyncStatus'

const { t } = useI18n()
const isOnline = useOnline()
const queueStore = useSyncQueueStore()

const pending = computed(() => queueStore.queue.length)
const { tone, visible } = useSyncStatus(isOnline, pending)

const icon = computed(() => (tone.value === 'syncing' ? ArrowPathIcon : SignalSlashIcon))

const label = computed(() => {
  switch (tone.value) {
    case 'syncing':
      return t('Sync.Syncing', { n: pending.value })
    case 'offline-pending':
      return t('Sync.OfflinePending', { n: pending.value })
    case 'offline':
      return t('Sync.Offline')
    default:
      return ''
  }
})
</script>

<style scoped>
/* Dezenter, nicht-blockierender Status-Pill oberhalb der Bottom-Nav. */
.sync-status {
  position: fixed;
  left: 50%;
  bottom: calc(var(--spacing-nav-height, 4rem) + var(--spacing-safe-bottom) + 0.6rem);
  transform: translateX(-50%);
  z-index: 45;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: calc(100vw - 2rem);
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-pill);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-elev-2);
  color: var(--text-default);
  font-size: var(--text-sm);
  font-weight: 600;
  pointer-events: none;
}

/* Auf Desktop ist die Bottom-Nav ausgeblendet — Pill rückt näher an den Rand. */
@media (min-width: 768px) {
  .sync-status {
    bottom: calc(var(--spacing-safe-bottom) + 1rem);
  }
}

.sync-status--offline,
.sync-status--offline-pending {
  color: color-mix(in oklab, var(--color-warning-600) 85%, var(--text-strong));
  border-color: color-mix(in oklab, var(--color-warning-500) 40%, var(--card-border));
  background: color-mix(in oklab, var(--color-warning-500) 8%, var(--card-bg));
}

:root.dark .sync-status--offline,
:root.dark .sync-status--offline-pending {
  color: var(--color-warning-400);
}

.sync-status__icon {
  width: 1.05rem;
  height: 1.05rem;
  flex-shrink: 0;
}

.sync-status__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.sync-status__icon--spin {
  animation: sync-spin 1s linear infinite;
}

@keyframes sync-spin {
  to { transform: rotate(360deg); }
}

/* Ein-/Ausblenden */
.sync-status-enter-active,
.sync-status-leave-active {
  transition: opacity 220ms var(--ease-standard), transform 220ms var(--ease-standard);
}
.sync-status-enter-from,
.sync-status-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .sync-status__icon--spin { animation: none; }
  .sync-status-enter-active,
  .sync-status-leave-active { transition: opacity 220ms var(--ease-standard); }
  .sync-status-enter-from,
  .sync-status-leave-to { transform: translateX(-50%); }
}
</style>
