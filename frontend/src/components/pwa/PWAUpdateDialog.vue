<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <aside
        v-if="updateAvailable"
        role="alertdialog"
        aria-live="polite"
        :aria-label="$t('PWA.UpdateAvailable')"
        class="update-dialog"
      >
        <div class="update-dialog__icon" aria-hidden="true">
          <ArrowPathIcon class="w-6 h-6" />
        </div>
        <div class="update-dialog__content">
          <h3 class="update-dialog__title">{{ $t('PWA.UpdateAvailable') }}</h3>
          <p class="update-dialog__hint">{{ $t('PWA.UpdateHint') }}</p>
        </div>
        <div class="update-dialog__actions">
          <button
            type="button"
            class="update-dialog__reload"
            :disabled="applying"
            @click="onApply"
          >
            <span v-if="applying" class="update-dialog__spinner" aria-hidden="true"></span>
            <span>{{ applying ? $t('PWA.Reloading') : $t('PWA.Reload') }}</span>
          </button>
          <button
            type="button"
            class="update-dialog__close"
            :aria-label="$t('PWA.InstallBanner.NotNow')"
            @click="dismissUpdate"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePWAUpdateStore } from '@/stores/pwaUpdate'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const pwaStore = usePWAUpdateStore()
const { updateAvailable } = storeToRefs(pwaStore)
const { applyUpdate, dismissUpdate } = pwaStore

const applying = ref(false)

async function onApply() {
  if (applying.value) return
  applying.value = true
  try {
    await applyUpdate()
  } finally {
    // applyUpdate löst window.location.reload() aus — applying bleibt true
    // bis zum Reload. Falls Reload fehlschlägt, sicherheitshalber zurücksetzen.
    setTimeout(() => { applying.value = false }, 3000)
  }
}
</script>

<style scoped>
.update-dialog {
  position: fixed;
  /* Mobile: volle Breite über der Bottom-Nav */
  bottom: calc(var(--spacing-nav-height) + var(--spacing-safe-bottom) + 0.75rem);
  left: 0.75rem;
  right: 0.75rem;
  z-index: 150;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-lg);
  /* Kräftige Brand-Tint: hebt sich deutlich von normalen Toasts ab */
  background: linear-gradient(
    135deg,
    color-mix(in oklab, var(--primary) 90%, black) 0%,
    color-mix(in oklab, var(--accent) 85%, black) 100%
  );
  color: var(--color-surface-0);
  box-shadow: var(--shadow-elev-3);
}

/* Desktop: kompakter Toast rechts-unten statt voller Breite */
@media (min-width: 768px) {
  .update-dialog {
    bottom: calc(var(--spacing-safe-bottom) + 1.25rem);
    left: auto;
    right: 1.5rem;
    width: min(26rem, calc(100vw - 3rem));
  }
}

/* Landscape auf sehr niedrigen Devices (iPhone 14 Pro Max quer ≈ 430×932 im
   Portrait, aber 932×430 quer): Dialog verdeckt zu viel — ausblenden.
   Der User sieht den Dialog beim nächsten Portrait-Aufruf wieder. */
@media (max-height: 480px) and (orientation: landscape) {
  .update-dialog { display: none; }
}

.update-dialog__icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: color-mix(in oklab, white 22%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  animation: update-spin 6s linear infinite;
}

@keyframes update-spin {
  to { transform: rotate(360deg); }
}

.update-dialog__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.update-dialog__title {
  font-size: var(--text-base);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-surface-0);
  line-height: 1.2;
}

.update-dialog__hint {
  font-size: var(--text-xs);
  color: color-mix(in oklab, white 80%, transparent);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-dialog__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.update-dialog__reload {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.95rem;
  min-height: 2.75rem;
  border-radius: var(--radius-pill);
  border: 0;
  background: var(--color-surface-0);
  color: var(--color-surface-900);
  font-weight: 700;
  font-size: var(--text-sm);
  transition: transform 120ms var(--ease-spring), opacity 150ms;
  cursor: pointer;
}
.update-dialog__reload:hover { transform: translateY(-1px); }
.update-dialog__reload:active { transform: translateY(0) scale(0.97); }
.update-dialog__reload:disabled { opacity: 0.7; pointer-events: none; }

.update-dialog__spinner {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: update-spin 700ms linear infinite;
}

.update-dialog__close {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  border: 0;
  background: color-mix(in oklab, white 15%, transparent);
  color: var(--color-surface-0);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms;
}
.update-dialog__close:hover {
  background: color-mix(in oklab, white 25%, transparent);
}

.slide-up-enter-active { transition: transform 320ms var(--ease-emphasize), opacity 200ms; }
.slide-up-leave-active { transition: transform 220ms var(--ease-standard), opacity 150ms; }
.slide-up-enter-from,
.slide-up-leave-to { opacity: 0; transform: translateY(30px); }

@media (prefers-reduced-motion: reduce) {
  .update-dialog__icon { animation: none; }
}
</style>
