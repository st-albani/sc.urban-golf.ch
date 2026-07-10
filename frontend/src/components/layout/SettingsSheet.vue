<template>
  <AppBottomSheet
    :model-value="modelValue"
    :label="$t('General.Settings')"
    :title="$t('General.Settings')"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <div class="settings">
      <section class="settings__section">
        <h3 class="t-eyebrow">{{ $t('Settings.Theme') }}</h3>
        <div class="settings__row">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            :class="['settings__pick', { 'is-active': themeSelection === opt.value }]"
            @click="setTheme(opt.value)"
          >
            <component :is="opt.icon" class="w-5 h-5" aria-hidden="true" />
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </section>

      <section class="settings__section">
        <h3 class="t-eyebrow">{{ $t('Settings.Language') }}</h3>
        <div class="settings__row settings__row--grid">
          <button
            v-for="(lang, code) in languages"
            :key="code"
            type="button"
            :class="['settings__pick', { 'is-active': locale === code }]"
            @click="setLanguage(code as string)"
          >
            <span class="settings__flag">{{ lang.flag }}</span>
            <span>{{ lang.label }}</span>
          </button>
        </div>
      </section>

      <section class="settings__section">
        <h3 class="t-eyebrow">{{ $t('Auth.Account') }}</h3>
        <div v-if="auth.isLoggedIn" class="settings__account">
          <div class="settings__account-info">
            <UserCircleIcon class="w-5 h-5" aria-hidden="true" />
            <span class="settings__account-email">{{ auth.account?.email }}</span>
          </div>
          <AppButton variant="ghost" size="sm" pill @click="auth.logout()">
            {{ $t('Auth.SignOut') }}
          </AppButton>
        </div>
        <template v-else>
          <p class="t-muted settings__account-hint">{{ $t('Auth.LoggedOutHint') }}</p>
          <AppButton variant="secondary" size="md" block pill @click="openLogin">
            {{ $t('Auth.SignInCta') }}
          </AppButton>
        </template>
      </section>

      <footer class="settings__meta">
        <span>{{ $t('General.Version') }}</span>
        <span class="settings__version">{{ appVersion }}</span>
      </footer>
    </div>
  </AppBottomSheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SunIcon, MoonIcon, ComputerDesktopIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useThemeMode } from '@/composables/useThemeMode'
import { useAuthStore } from '@/stores/auth'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { isDark, set: setIsDark } = useThemeMode()
const { locale, t } = useI18n()
const auth = useAuthStore()

// Login startet im global gemounteten AuthSheet — Settings vorher schließen.
function openLogin() {
  emit('update:modelValue', false)
  auth.openLogin()
}

type ThemeValue = 'light' | 'dark' | 'system'

const manualSelection = ref<ThemeValue | null>(
  typeof localStorage !== 'undefined' && localStorage.getItem('theme') !== null
    ? (isDark.value ? 'dark' : 'light')
    : 'system'
)

const themeSelection = computed<ThemeValue>(() => manualSelection.value ?? 'system')

const themeOptions = computed(() => [
  { value: 'light' as const, label: t('Settings.ThemeLight'), icon: SunIcon },
  { value: 'dark' as const, label: t('Settings.ThemeDark'), icon: MoonIcon },
  { value: 'system' as const, label: t('Settings.ThemeSystem'), icon: ComputerDesktopIcon },
])

function setTheme(v: ThemeValue) {
  if (v === 'system') {
    localStorage.removeItem('theme')
    manualSelection.value = 'system'
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefers)
  } else {
    manualSelection.value = v
    setIsDark(v === 'dark')
  }
}

const languages: Record<string, { label: string; flag: string }> = {
  de: { label: 'Deutsch', flag: '🇩🇪' },
  en: { label: 'English', flag: '🇬🇧' },
  fr: { label: 'Français', flag: '🇫🇷' },
  nl: { label: 'Nederlands', flag: '🇳🇱' },
}

function setLanguage(code: string) {
  locale.value = code
  localStorage.setItem('language', code)
}

const appVersion = __APP_VERSION__
</script>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 1.25rem; padding: 0.25rem 0 0.5rem; }
.settings__section { display: flex; flex-direction: column; gap: 0.6rem; }

.settings__row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.settings__row--grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }

.settings__pick {
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  min-height: 2.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-default);
  font-weight: 600;
  font-size: var(--text-sm);
  transition: border-color 150ms, color 150ms, background 150ms;
  min-width: 0;
}

.settings__pick:hover { border-color: var(--primary); color: var(--primary); }
.settings__pick.is-active {
  border-color: var(--primary);
  background: color-mix(in oklab, var(--primary) 14%, transparent);
  color: var(--primary);
}

.settings__flag { font-size: 1.15rem; line-height: 1; }

.settings__account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
}

.settings__account-info {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--text-default);
}

.settings__account-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: var(--text-sm);
}

.settings__account-hint {
  font-size: var(--text-sm);
  margin-bottom: 0.1rem;
}

.settings__meta {
  display: flex;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--divider);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.settings__version {
  font-variant-numeric: tabular-nums;
  color: var(--text-default);
  font-weight: 500;
}
</style>
