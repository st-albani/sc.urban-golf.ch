import { ref } from 'vue'
import { defineStore } from 'pinia'

type UpdateFn = (reload?: boolean) => Promise<void>

export const usePWAUpdateStore = defineStore('pwaUpdate', () => {
  const updateAvailable = ref(false)
  const updateFn = ref<UpdateFn | null>(null)

  /**
   * Called from the vite-plugin-pwa registerSW onNeedRefresh callback in
   * main.ts. Holds the SW update function and surfaces the dialog.
   */
  function registerUpdate(fn: UpdateFn) {
    updateFn.value = fn
    updateAvailable.value = true
  }

  /**
   * Wendet das neue Service-Worker Paket an und lädt die App neu.
   *
   * `updateSW(true)` macht den `skipWaiting`-Handshake mit dem wartenden SW
   * (Listener in `sw-custom.ts`). Danach lädt `virtual:pwa-register` die Seite
   * nach dem `controllerchange` automatisch **einmal** neu. Ein zusätzlicher
   * manueller Reload würde einen Doppel-Reload (kurz alte Seite) auslösen —
   * deshalb reloaden wir nur, falls der Handshake wirft.
   */
  async function applyUpdate() {
    updateAvailable.value = false
    try {
      await updateFn.value?.(true)
    } catch (err) {
      console.warn('[PWA] updateSW(true) failed, reloading manually:', err)
      if (typeof window !== 'undefined') {
        try { window.location.reload() } catch { /* ignore — test env */ }
      }
    }
  }

  function dismissUpdate() {
    updateAvailable.value = false
  }

  return { updateAvailable, registerUpdate, applyUpdate, dismissUpdate }
})
