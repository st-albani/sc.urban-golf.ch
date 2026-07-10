import { ref, onBeforeUnmount } from 'vue'
import jsQR from 'jsqr'

export type ScannerError = 'denied' | 'unsupported' | null

/**
 * Liest QR-Codes über die Gerätekamera. Die Kamera läuft nur zwischen
 * start() und stop()/Fund — danach werden alle Tracks sofort freigegeben.
 * Der Decode-Loop läuft über ein Offscreen-Canvas + jsQR.
 */
export function useQrScanner(onDecode: (text: string) => void) {
  const scanning = ref(false)
  const error = ref<ScannerError>(null)

  let stream: MediaStream | null = null
  let rafId = 0
  let video: HTMLVideoElement | null = null
  let canvas: HTMLCanvasElement | null = null

  async function start(videoEl: HTMLVideoElement): Promise<void> {
    error.value = null
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      error.value = 'unsupported'
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch {
      error.value = 'denied'
      return
    }
    video = videoEl
    video.srcObject = stream
    try {
      await video.play()
    } catch {
      /* Autoplay-Restriktion — der Frame-Loop wartet ohnehin auf Daten. */
    }
    canvas = document.createElement('canvas')
    scanning.value = true
    tick()
  }

  function tick(): void {
    if (!scanning.value || !video || !canvas) return
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const w = video.videoWidth
      const h = video.videoHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h)
        const frame = ctx.getImageData(0, 0, w, h)
        const result = jsQR(frame.data, w, h)
        if (result?.data) {
          stop()
          onDecode(result.data)
          return
        }
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    scanning.value = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
    if (video) {
      video.srcObject = null
      video = null
    }
    canvas = null
  }

  onBeforeUnmount(stop)

  return { scanning, error, start, stop }
}
