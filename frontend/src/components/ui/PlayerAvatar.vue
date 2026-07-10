<template>
  <span
    class="avatar"
    :class="[`avatar--${size}`, ringed && 'avatar--ringed', src && 'avatar--image']"
    :style="{ '--avatar-color': color }"
    :title="name"
    :aria-label="name"
  >
    <img v-if="src" :src="src" class="avatar__img" alt="" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  ringed?: boolean
  src?: string | null
}>(), {
  size: 'md',
  ringed: false,
  src: null,
})

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})
</script>

<style scoped>
.avatar {
  --avatar-color: var(--color-brand-500);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in oklab, var(--avatar-color) 22%, var(--card-bg));
  color: color-mix(in oklab, var(--avatar-color) 80%, var(--text-strong));
  border: 2px solid color-mix(in oklab, var(--avatar-color) 40%, transparent);
  font-weight: 700;
  font-size: 0.8em;
  line-height: 1;
  letter-spacing: 0.03em;
  user-select: none;
  flex-shrink: 0;
}

.avatar--xs { width: 1.5rem; height: 1.5rem; font-size: 0.65rem; border-width: 1.5px; }
.avatar--sm { width: 2rem; height: 2rem; font-size: 0.75rem; }
.avatar--md { width: 2.5rem; height: 2.5rem; font-size: 0.85rem; }
.avatar--lg { width: 3.25rem; height: 3.25rem; font-size: 1rem; }
.avatar--xl { width: 4.5rem; height: 4.5rem; font-size: 1.4rem; border-width: 3px; }

.avatar--ringed {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--avatar-color) 25%, transparent);
}

/* Mit Bild: keine Tint-Fläche, Bild füllt den Kreis. */
.avatar--image {
  background: var(--card-bg);
  overflow: hidden;
  padding: 0;
}

.avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
  display: block;
}
</style>
