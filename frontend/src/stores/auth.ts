import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  fetchMe,
  logout as apiLogout,
  setProfile as apiSetProfile,
  deleteAccount as apiDeleteAccount,
  setAvatar as apiSetAvatar,
  type Account,
} from '@/services/api'

/**
 * Optionale Identität. Der Login ist nie erzwungen — anonyme Nutzung bleibt
 * jederzeit möglich. Die Session lebt in einem HttpOnly-Cookie (serverseitig);
 * hier halten wir nur den abgeleiteten Zustand.
 */
export const useAuthStore = defineStore('auth', () => {
  const account = ref<Account | null>(null)
  const loaded = ref(false)
  // Sichtbarkeit des globalen Login-Sheets (global gemountet, damit es nicht
  // an der Lebensdauer des Settings-Sheets hängt).
  const loginOpen = ref(false)

  const isLoggedIn = computed(() => account.value !== null)
  const displayName = computed(() => account.value?.displayName || null)
  const avatar = computed(() => account.value?.avatar || null)
  const playerId = computed(() => account.value?.playerId || null)

  function openLogin() {
    loginOpen.value = true
  }
  function closeLogin() {
    loginOpen.value = false
  }

  /** Beim App-Start: bestehende Session wiederherstellen (still bei 401). */
  async function loadMe() {
    account.value = await fetchMe()
    loaded.value = true
  }

  async function requestOtp(email: string) {
    await apiRequestOtp(email)
  }

  /** Verifiziert den Code und loggt ein. Wirft bei ungültigem Code. */
  async function verifyOtp(email: string, code: string) {
    account.value = await apiVerifyOtp(email, code)
  }

  async function logout() {
    try {
      await apiLogout()
    } finally {
      account.value = null
    }
  }

  /** Anzeigename setzen. Etabliert die kanonische Selbst-Identität serverseitig. */
  async function setDisplayName(name: string): Promise<void> {
    account.value = await apiSetProfile(name)
  }

  async function deleteAccount(keepScores: boolean) {
    try {
      await apiDeleteAccount(keepScores)
    } finally {
      account.value = null
    }
  }

  /** Avatar setzen (data:-URL) oder mit '' entfernen. */
  async function setAvatar(dataUrl: string) {
    account.value = await apiSetAvatar(dataUrl)
  }

  return {
    account, loaded, loginOpen, isLoggedIn, displayName, avatar, playerId,
    openLogin, closeLogin, loadMe, requestOtp, verifyOtp, logout,
    setDisplayName, deleteAccount, setAvatar,
  }
})
