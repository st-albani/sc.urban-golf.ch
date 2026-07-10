<template>
  <transition name="fade">
    <button
      v-if="showScrollToTop"
      @click="scrollToTop"
      class="scroll-top-btn"
      :aria-label="$t('General.ScrollToTop')"
    >
      <ArrowUpIcon class="w-5 h-5" />
    </button>
  </transition>
</template>

<script setup lang="ts">
import { ArrowUpIcon } from '@heroicons/vue/24/outline'
import { useScrollToTopButton } from '@/composables/useScrollToTopButton'

const { showScrollToTop, scrollToTop } = useScrollToTopButton()
</script>

<style scoped>
.scroll-top-btn {
  position: fixed;
  right: 1rem;
  bottom: calc(var(--spacing-nav-height) + var(--spacing-safe-bottom) + 5rem);
  z-index: 29;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  background: var(--card-bg);
  color: var(--text-default);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-elev-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 150ms var(--ease-spring), background 150ms;
}

@media (min-width: 768px) {
  .scroll-top-btn { bottom: 1.5rem; }
}

.scroll-top-btn:hover { background: var(--card-bg); color: var(--primary); }
.scroll-top-btn:active { transform: scale(0.92); }
</style>
