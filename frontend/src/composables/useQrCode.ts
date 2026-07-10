import { ref, watch, type Ref } from 'vue'
import QRCode from 'qrcode'

/**
 * Erzeugt clientseitig einen QR-Code als data:-URL (PNG) aus einem Text.
 * data:-Bilder sind CSP-konform (kein externer Request) und lassen sich
 * direkt in ein <img> hängen.
 */
export function useQrCode(text: Ref<string>) {
  const dataUrl = ref('')
  const failed = ref(false)

  async function generate(value: string) {
    if (!value) {
      dataUrl.value = ''
      return
    }
    try {
      dataUrl.value = await QRCode.toDataURL(value, { margin: 1, width: 240 })
      failed.value = false
    } catch {
      dataUrl.value = ''
      failed.value = true
    }
  }

  watch(text, (v) => void generate(v), { immediate: true })

  return { dataUrl, failed }
}
