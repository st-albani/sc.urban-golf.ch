<template>
  <div
    :class="['segmented', block && 'segmented--block']"
    role="tablist"
    :aria-label="label"
  >
    <button
      v-for="(opt, idx) in options"
      :key="String(opt.value)"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.value"
      :aria-label="opt.label || undefined"
      :class="['segmented__item', { 'is-active': modelValue === opt.value }]"
      @click="emit('update:modelValue', opt.value)"
    >
      <component v-if="opt.icon" :is="opt.icon" class="segmented__icon" aria-hidden="true" />
      <span v-if="opt.label" class="segmented__label">{{ opt.label }}</span>
      <span v-else-if="!opt.icon" class="segmented__label">{{ idx }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import type { Component } from 'vue'

interface Option {
  value: T
  label?: string
  icon?: Component
}

withDefaults(defineProps<{
  modelValue: T
  options: Option[]
  label: string
  block?: boolean
}>(), {
  block: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<style scoped>
.segmented {
  display: inline-flex;
  padding: 0.25rem;
  background: color-mix(in oklab, var(--text-default) 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--text-default) 6%, transparent);
  border-radius: var(--radius-pill);
  gap: 0.15rem;
  max-width: 100%;
}

.segmented--block {
  display: flex;
  width: 100%;
}

.segmented--block .segmented__item {
  flex: 1 1 0;
  min-width: 0;
}

.segmented__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  /* Tap-Target min 44 px für WCAG 2.5.5 */
  min-height: 2.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: color 150ms, background 200ms var(--ease-standard), box-shadow 150ms, border-color 150ms;
  min-width: 0;
}
.segmented__item:hover { color: var(--text-strong); }

.segmented__item.is-active {
  /* Leichter Helligkeits-Lift über --card-bg: im Dark-Mode (text-default hell)
     hebt sich die Kachel klarer vom Track ab, im Light-Mode praktisch neutral. */
  background: color-mix(in oklab, var(--text-default) 5%, var(--card-bg));
  color: var(--text-strong);
  border-color: color-mix(in oklab, var(--text-default) 22%, transparent);
  box-shadow: var(--card-shadow);
}

.segmented__icon {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
}

.segmented__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Auf schmalen Screens im Block-Modus nur Icons zeigen */
@media (max-width: 520px) {
  .segmented--block .segmented__label { display: none; }
  .segmented--block .segmented__item { padding-inline: 0.75rem; gap: 0; }
}
</style>
