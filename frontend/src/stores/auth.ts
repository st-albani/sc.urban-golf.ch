import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  fetchMe,
  logout as apiLogout,
  setProfile as apiSetProfile,
  deleteAccount as apiDeleteAccount,
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

  /** Anzeigename setzen und eigene Spieler-Einträge beanspruchen. */
  async function setDisplayName(name: string): Promise<number> {
    const { account: updated, claimedCount } = await apiSetProfile(name)
    account.value = updated
    return claimedCount
  }

  async function deleteAccount(keepScores: boolean) {
    try {
      await apiDeleteAccount(keepScores)
    } finally {
      account.value = null
    }
  }

  return {
    account, loaded, loginOpen, isLoggedIn, displayName,
    openLogin, closeLogin, loadMe, requestOtp, verifyOtp, logout, setDisplayName, deleteAccount,
  }
})
