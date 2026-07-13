import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/global.css'
import axios from 'axios'
import { createI18n } from 'vue-i18n'
import { registerSW } from 'virtual:pwa-register'
import { usePWAUpdateStore } from './stores/pwaUpdate'
import { useToast } from './composables/useToast'

import de from './locales/de.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import nl from './locales/nl.json'

// Axios configuration
axios.defaults.baseURL = import.meta.env.VITE_API_BASEURL
axios.defaults.headers.common['Content-Type'] = 'application/json'
// Session-Cookies mitsenden (optionale Identität via E-Mail-OTP).
axios.defaults.withCredentials = true

// Detect locale: saved preference > browser language > fallback 'en'
function detectLocale(): string {
  const saved = localStorage.getItem('language')
  if (saved && ['de', 'en', 'fr', 'nl'].includes(saved)) return saved

  const lang = navigator.language
  if (lang.startsWith('de')) return 'de'
  if (lang.startsWith('fr')) return 'fr'
  if (lang.startsWith('nl')) return 'nl'
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { de, en, fr, nl },
})

// Helper to get i18n translations in interceptor
const t = (key: string) => (i18n.global as unknown as { t: (k: string) => string }).t(key)

// Axios Response Interceptor: Retry + global error handling
axios.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config
    if (!config) return Promise.reject(error)

    // 4xx: no retry, show toast (except 401/403). 403 ist ein erwartetes
    // „kein Zugriff" (private Spiele) und wird von der jeweiligen View über
    // ihren Fehlerzustand behandelt — kein Toast (sonst spammt das Polling).
    if (error.response?.status >= 400 && error.response?.status < 500) {
      if (error.response.status !== 401 && error.response.status !== 403) {
        const { error: showError } = useToast()
        showError(`${t('Errors.RequestFailed')} (${error.response.status})`)
      }
      return Promise.reject(error)
    }

    // Network error / 5xx: up to 2 retries with exponential backoff
    config._retryCount = (config._retryCount || 0) + 1
    if (config._retryCount > 2) {
      const { error: showError } = useToast()
      showError(t('Errors.NetworkError'))
      return Promise.reject(error)
    }
    await new Promise(r => setTimeout(r, 500 * Math.pow(2, config._retryCount)))
    return axios(config)
  }
)

createApp(App)
  .use(router)
  .use(i18n)
  .use(createPinia())
  .mount('#app')

// Sync i18n locale to HTML lang attribute
watch(
  () => i18n.global.locale.value,
  (lang) => document.documentElement.setAttribute('lang', lang),
  { immediate: true }
)

// PWA Service Worker registration. Pinia must be installed first (see
// createApp().use(createPinia()) above) so the store can be accessed here.
const pwaStore = usePWAUpdateStore()

const updateSW = registerSW({
  onNeedRefresh() {
    pwaStore.registerUpdate(updateSW)
  },
  onOfflineReady() {
    // App is ready for offline use
  },
})
