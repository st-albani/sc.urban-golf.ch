<template>
  <AppBottomSheet
    :model-value="modelValue"
    :label="$t('Profile.Title')"
    :title="$t('Profile.Title')"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <div class="settings">
      <!-- Profil-Header -->
      <section class="profile">
        <div class="profile__avatar-wrap">
          <PlayerAvatar :name="avatarName" :src="auth.avatar" color="var(--color-player-1)" size="xl" />
          <button
            v-if="auth.isLoggedIn"
            type="button"
            class="profile__avatar-edit"
            :aria-label="$t('Profile.ChangeAvatar')"
            :disabled="avatarBusy"
            @click="pickAvatar"
          >
            <CameraIcon class="w-4 h-4" />
          </button>
          <input ref="avatarInput" type="file" accept="image/*" class="profile__file" @change="onAvatarFile" />
        </div>
        <div class="profile__identity">
          <span class="profile__name">
            {{ auth.isLoggedIn ? (auth.displayName || $t('Profile.NoName')) : $t('Profile.Guest') }}
          </span>
          <span class="profile__email">
            {{ auth.isLoggedIn ? auth.account?.email : $t('Auth.LoggedOutHint') }}
          </span>
        </div>
        <AppButton v-if="!auth.isLoggedIn" variant="primary" size="md" block pill @click="openLogin">
          {{ $t('Auth.SignInCta') }}
        </AppButton>
      </section>

      <!-- Account-Aktionen (eingeloggt) -->
      <section v-if="auth.isLoggedIn" class="settings__section">
        <label class="t-eyebrow settings__name-label" for="settings-name">{{ $t('Auth.DisplayNameLabel') }}</label>
        <div class="settings__name-row">
          <input
            id="settings-name"
            v-model="nameInput"
            class="field settings__name-input"
            type="text"
            maxlength="30"
            :placeholder="$t('Auth.DisplayNamePlaceholder')"
            @keydown.enter="saveName"
          />
          <AppButton variant="secondary" size="md" pill :loading="savingName" :disabled="!nameInput.trim()" @click="saveName">
            {{ $t('General.Send') }}
          </AppButton>
        </div>
        <AppButton variant="ghost" size="md" block pill tag="router-link" to="/account" @click="emit('update:modelValue', false)">
          <template #icon-left><ChartBarIcon class="w-5 h-5" /></template>
          {{ $t('Auth.MyStats') }}
        </AppButton>
      </section>

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

      <AppButton
        v-if="auth.isLoggedIn"
        variant="ghost"
        size="md"
        block
        pill
        class="settings__logout"
        @click="auth.logout()"
      >
        {{ $t('Auth.SignOut') }}
      </AppButton>

      <footer class="settings__meta">
        <span>{{ $t('General.Version') }}</span>
        <span class="settings__version">{{ appVersion }}</span>
      </footer>
    </div>
  </AppBottomSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SunIcon, MoonIcon, ComputerDesktopIcon, CameraIcon, ChartBarIcon } from '@heroicons/vue/24/outline'
import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import PlayerAvatar from '@/components/ui/PlayerAvatar.vue'
import { useThemeMode } from '@/composables/useThemeMode'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { isDark, set: setIsDark } = useThemeMode()
const { locale, t } = useI18n()
const auth = useAuthStore()
const { success, error: toastError } = useToast()

// Login startet im global gemounteten AuthSheet — Settings vorher schließen.
function openLogin() {
  emit('update:modelValue', false)
  auth.openLogin()
}

const avatarName = computed(() => auth.displayName || auth.account?.email || 'Profil')

const avatarInput = ref<HTMLInputElement | null>(null)
const avatarBusy = ref(false)

function pickAvatar() {
  avatarInput.value?.click()
}

// Bild clientseitig auf 128×128 (Cover-Crop) verkleinern → JPEG-Data-URL.
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no-2d-context'))
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image-load-failed'))
    }
    img.src = url
  })
}

async function onAvatarFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || avatarBusy.value) return
  avatarBusy.value = true
  try {
    const dataUrl = await resizeImage(file)
    await auth.setAvatar(dataUrl)
    success(t('Profile.AvatarUpdated'))
  } catch {
    toastError(t('Profile.AvatarFailed'))
  } finally {
    avatarBusy.value = false
  }
}

const nameInput = ref('')
const savingName = ref(false)

// Anzeigename ins Feld übernehmen, wenn das Sheet öffnet / Account lädt.
watch(
  () => [props.modelValue, auth.account?.displayName] as const,
  ([open]) => {
    if (open) nameInput.value = auth.account?.displayName || ''
  },
  { immediate: true },
)

async function saveName() {
  const name = nameInput.value.trim()
  if (!name || savingName.value) return
  savingName.value = true
  try {
    const count = await auth.setDisplayName(name)
    success(count > 0 ? t('Auth.NameClaimed', { count }) : t('Auth.NameSaved'))
  } finally {
    savingName.value = false
  }
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

/* Profil-Header */
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  padding: 0.5rem 0 0.25rem;
}

.profile__avatar-wrap {
  position: relative;
  display: inline-flex;
}

.profile__avatar-edit {
  position: absolute;
  right: -0.1rem;
  bottom: -0.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  border: 2px solid var(--card-bg);
  background: var(--primary);
  color: var(--primary-ink);
  cursor: pointer;
  transition: transform 150ms, opacity 150ms;
}

.profile__avatar-edit:hover { transform: scale(1.08); }
.profile__avatar-edit:active { transform: scale(0.94); }
.profile__avatar-edit:disabled { opacity: 0.55; cursor: default; }

.profile__file {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.profile__identity {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  max-width: 100%;
}

.profile__name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.profile__email {
  font-size: var(--text-sm);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings__name-label {
  margin: 0.1rem 0 -0.25rem;
}

.settings__name-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.settings__name-input {
  flex: 1 1 auto;
  min-width: 0;
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
