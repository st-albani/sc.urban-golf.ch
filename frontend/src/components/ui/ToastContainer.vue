<template>
  <Teleport to="body">
    <div
      class="toast-stack"
      role="alert"
      aria-live="polite"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast--${toast.type}`]"
        >
          <span class="toast__dot" aria-hidden="true"></span>
          <span class="toast__message">{{ toast.message }}</span>
          <button
            @click="dismiss(toast.id)"
            class="toast__close"
            :aria-label="$t('General.DismissNotification')"
          >&times;</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<style scoped>
.toast-stack {
  position: fixed;
  top: calc(0.75rem + var(--spacing-safe-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(90vw, 28rem);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.95rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-elev-2);
  background: var(--card-bg);
  color: var(--text-strong);
  border: 1px solid var(--card-border);
  font-size: var(--text-sm);
  font-weight: 500;
}

.toast__message { flex: 1; }

.toast__close {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.25rem;
  line-height: 1;
  padding: 0 0.25rem;
}
.toast__close:hover { color: var(--text-strong); }

.toast__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  background: var(--text-muted);
  flex-shrink: 0;
}

.toast--success { border-color: color-mix(in oklab, var(--color-success-500) 35%, var(--card-border)); }
.toast--success .toast__dot { background: var(--color-success-500); }
.toast--error   { border-color: color-mix(in oklab, var(--color-danger-500) 35%, var(--card-border)); }
.toast--error   .toast__dot { background: var(--color-danger-500); }
.toast--warning { border-color: color-mix(in oklab, var(--color-warning-500) 35%, var(--card-border)); }
.toast--warning .toast__dot { background: var(--color-warning-500); }
.toast--info    { border-color: color-mix(in oklab, var(--color-info-500) 35%, var(--card-border)); }
.toast--info    .toast__dot { background: var(--color-info-500); }

.toast-enter-active { transition: transform 220ms var(--ease-spring), opacity 200ms; }
.toast-leave-active { transition: transform 180ms var(--ease-standard), opacity 150ms; }
.toast-enter-from { opacity: 0; transform: translateY(-12px); }
.toast-leave-to { opacity: 0; transform: translateY(-6px) scale(0.96); }
</style>
