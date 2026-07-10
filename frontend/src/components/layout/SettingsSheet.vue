<template>
  <AppBottomSheet
    :model-value="modelValue"
    :label="$t('Profile.Title')"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="sheet-nav">
        <button
          v-if="panel !== 'root'"
          type="button"
          class="sheet-nav__back"
          :aria-label="$t('General.Back')"
          @click="panel = 'root'"
        >
          <ArrowLeftIcon />
        </button>
        <h2 class="t-subtitle">{{ panelTitle }}</h2>
      </div>
    </template>

    <Transition name="panel" mode="out-in">
      <div :key="panel" class="settings">
        <!-- ===== Root: Profil-Übersicht ===== -->
        <template v-if="panel === 'root'">
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

          <!-- Konto -->
          <section v-if="auth.isLoggedIn" class="sgroup">
            <h3 class="t-eyebrow sgroup__title">{{ $t('Auth.Account') }}</h3>
            <div class="sgroup__rows">
              <button type="button" class="srow" @click="panel = 'name'">
                <UserIcon class="srow__icon" />
                <span class="srow__label">{{ $t('Auth.DisplayNameLabel') }}</span>
                <span class="srow__value">{{ auth.displayName || $t('Profile.NoName') }}</span>
                <ChevronRightIcon class="srow__chevron" />
              </button>
              <router-link class="srow" to="/account" @click="closeSheet">
                <ChartBarIcon class="srow__icon" />
                <span class="srow__label">{{ $t('Auth.MyStats') }}</span>
                <ChevronRightIcon class="srow__chevron" />
              </router-link>
            </div>
          </section>

          <!-- Einstellungen -->
          <section class="sgroup">
            <h3 class="t-eyebrow sgroup__title">{{ $t('General.Settings') }}</h3>
            <div class="sgroup__rows">
              <button type="button" class="srow" @click="panel = 'theme'">
                <SwatchIcon class="srow__icon" />
                <span class="srow__label">{{ $t('Settings.Theme') }}</span>
                <span class="srow__value">{{ currentThemeLabel }}</span>
                <ChevronRightIcon class="srow__chevron" />
              </button>
              <button type="button" class="srow" @click="panel = 'language'">
                <LanguageIcon class="srow__icon" />
                <span class="srow__label">{{ $t('Settings.Language') }}</span>
                <span class="srow__value">{{ currentLanguageLabel }}</span>
                <ChevronRightIcon class="srow__chevron" />
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
        </template>

        <!-- ===== Sub-Panel: Anzeigename ===== -->
        <template v-else-if="panel === 'name'">
          <section class="settings__section">
            <p class="t-muted settings__panel-hint">{{ $t('Auth.NameHint') }}</p>
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
          </section>
        </template>

        <!-- ===== Sub-Panel: Design ===== -->
        <template v-else-if="panel === 'theme'">
          <section class="settings__section">
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
        </template>

        <!-- ===== Sub-Panel: Sprache ===== -->
        <template v-else>
          <section class="settings__section">
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
        </template>
      </div>
    </Transition>
  </AppBottomSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SunIcon, MoonIcon, ComputerDesktopIcon, CameraIcon,
  UserIcon, ChartBarIcon, SwatchIcon, LanguageIcon,
  ChevronRightIcon, ArrowLeftIcon,
} from '@heroicons/vue/24/outline'
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

// In-Sheet-Navigation (Drill-down). 'root' = Übersicht, sonst ein Sub-Panel.
type Panel = 'root' | 'name' | 'theme' | 'language'
const panel = ref<Panel>('root')

const panelTitle = computed(() => {
  switch (panel.value) {
    case 'name': return t('Auth.DisplayNameLabel')
    case 'theme': return t('Settings.Theme')
    case 'language': return t('Settings.Language')
    default: return t('Profile.Title')
  }
})

// Beim Öffnen immer auf der Übersicht starten.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      panel.value = 'root'
      nameInput.value = auth.account?.displayName || ''
    }
  },
)

function closeSheet() {
  emit('update:modelValue', false)
}

// Login startet im global gemounteten AuthSheet — Settings vorher schließen.
function openLogin() {
  closeSheet()
  auth.openLogin()
}

// ---- Avatar-Upload ----
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

// ---- Anzeigename ----
const nameInput = ref('')
const savingName = ref(false)

async function saveName() {
  const name = nameInput.value.trim()
  if (!name || savingName.value) return
  savingName.value = true
  try {
    await auth.setDisplayName(name)
    success(t('Auth.NameSaved'))
    panel.value = 'root'
  } finally {
    savingName.value = false
  }
}

// ---- Theme ----
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

const currentThemeLabel = computed(
  () => themeOptions.value.find((o) => o.value === themeSelection.value)?.label ?? '',
)

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

// ---- Sprache ----
const languages: Record<string, { label: string; flag: string }> = {
  de: { label: 'Deutsch', flag: '🇩🇪' },
  en: { label: 'English', flag: '🇬🇧' },
  fr: { label: 'Français', flag: '🇫🇷' },
  nl: { label: 'Nederlands', flag: '🇳🇱' },
}

const currentLanguageLabel = computed(() => languages[locale.value]?.label ?? locale.value)

function setLanguage(code: string) {
  locale.value = code
  localStorage.setItem('language', code)
}

const appVersion = __APP_VERSION__
</script>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 1.25rem; padding: 0.25rem 0 0.5rem; }
.settings__section { display: flex; flex-direction: column; gap: 0.6rem; }

/* ---- In-Sheet-Navigation ---- */
.sheet-nav { display: flex; align-items: center; gap: 0.4rem; }

.sheet-nav__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin-left: -0.4rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-default);
  cursor: pointer;
  transition: background 150ms;
}
.sheet-nav__back:hover { background: color-mix(in oklab, var(--text-default) 8%, transparent); }
.sheet-nav__back:active { transform: scale(0.92); }
.sheet-nav__back :deep(svg) { width: 1.25rem; height: 1.25rem; }

.panel-enter-active,
.panel-leave-active {
  transition: opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
}
.panel-enter-from { opacity: 0; transform: translateX(14px); }
.panel-leave-to { opacity: 0; transform: translateX(-10px); }

/* ---- Gruppierte Menü-Zeilen ---- */
.sgroup { display: flex; flex-direction: column; gap: 0.5rem; }
.sgroup__title { padding-left: 0.25rem; }

.sgroup__rows {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  overflow: hidden;
}

.srow {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.75rem 0.9rem;
  border: 0;
  background: transparent;
  color: var(--text-default);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background 150ms;
}
.srow + .srow { border-top: 1px solid var(--divider); }
.srow:hover { background: color-mix(in oklab, var(--text-default) 5%, transparent); }
.srow:active { background: color-mix(in oklab, var(--text-default) 9%, transparent); }

.srow__icon { width: 1.25rem; height: 1.25rem; color: var(--text-muted); flex-shrink: 0; }
.srow__label { flex: 1 1 auto; font-weight: 600; font-size: var(--text-sm); }
.srow__value {
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 48%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.srow__chevron { width: 1.1rem; height: 1.1rem; color: var(--text-muted); flex-shrink: 0; }

/* ---- Theme-/Sprach-Auswahl (Sub-Panels) ---- */
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

.settings__panel-hint { font-size: var(--text-sm); margin-bottom: 0.1rem; }

/* ---- Profil-Header ---- */
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  padding: 0.5rem 0 0.25rem;
}

.profile__avatar-wrap { position: relative; display: inline-flex; }

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

.profile__identity { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; max-width: 100%; }

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

.settings__name-label { margin: 0.1rem 0 -0.25rem; }
.settings__name-row { display: flex; gap: 0.5rem; align-items: center; }
.settings__name-input { flex: 1 1 auto; min-width: 0; }

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
