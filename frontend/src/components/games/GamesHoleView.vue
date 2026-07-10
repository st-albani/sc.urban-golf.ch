<template>
  <div class="container-app hole-view" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <!-- Breadcrumb: intuitiver Weg zurück zur Scorecard. Ersetzt die
         alte Breadcrumb-Navigation (vor dem Redesign) und reduziert
         die Belastung in der Bottom-Action-Bar. -->
    <router-link :to="`/games/${gameId}`" class="hole-view__breadcrumb">
      <ChevronLeftIcon class="w-4 h-4" />
      <span>{{ $t('General.Scorecard') }}</span>
      <span class="hole-view__breadcrumb-sep" aria-hidden="true">/</span>
      <span class="hole-view__breadcrumb-context">{{ displayName }}</span>
    </router-link>

    <!-- Kopf: Loch + inline Back/Forward + Edit-Aktion.
         Die Loch-Navigation sitzt direkt am Hero — nach iOS-Kalender-Pattern.
         Dadurch brauchen wir keinen fixed Bottom-Bar mehr, und die Bottom-Nav
         (Home/Spiele/Neues Spiel/Über uns) bleibt sichtbar. -->
    <header class="hole-header">
      <div class="hole-stepper" role="group" :aria-label="$t('General.Hole')">
        <button
          type="button"
          class="hole-stepper__btn"
          :class="{ 'is-disabled': hole <= 1 }"
          :aria-label="$t('Games.HoleView.StepperBack', { n: hole - 1 })"
          :aria-hidden="hole <= 1 || undefined"
          :tabindex="hole <= 1 ? -1 : undefined"
          @click="$router.push(`/games/${gameId}/${hole - 1}`)"
        >
          <ChevronLeftIcon class="w-5 h-5" />
        </button>
        <h1 class="hole-header__title">
          <span class="hole-header__label">{{ $t('General.Hole') }}</span>
          <span class="hole-header__number">{{ hole }}</span>
        </h1>
        <button
          type="button"
          class="hole-stepper__btn"
          :aria-label="$t('Games.HoleView.StepperForward', { n: hole + 1 })"
          @click="$router.push(`/games/${gameId}/${hole + 1}`)"
        >
          <ChevronRightIcon class="w-5 h-5" />
        </button>
      </div>

      <div class="hole-header__actions">
        <AppIconButton
          :label="$t('Share.Title')"
          variant="outline"
          size="md"
          @click="shareOpen = true"
        >
          <ShareIcon class="w-5 h-5" />
        </AppIconButton>
        <AppIconButton
          :label="$t('Games.HoleView.EditGame')"
          variant="outline"
          size="md"
          @click="$router.push(`/games/new/${gameId}`)"
        >
          <PencilSquareIcon class="w-5 h-5" />
        </AppIconButton>
      </div>
    </header>

    <!-- Fortschritt: Loch-Pills. Der Add-Button liegt bewusst ausserhalb des
         scrollenden Containers, damit er bei vielen Löchern nicht am rechten
         Rand abgeschnitten wird. -->
    <div class="hole-progress-row">
      <div ref="pillsRef" class="hole-progress scroll-hide" role="list">
        <router-link
          v-for="n in holes"
          :key="n"
          :ref="el => setPillRef(n, el as unknown as { $el?: HTMLElement } | HTMLElement | null)"
          :to="`/games/${gameId}/${n}`"
          :class="['hole-progress__chip', {
            'is-current': n === hole,
            'is-partial': holeStateFor(n) === 'partial',
            'is-complete': holeStateFor(n) === 'complete',
          }]"
          :aria-label="pillAriaLabel(n)"
          role="listitem"
        >
          {{ n }}
          <CheckIcon v-if="holeStateFor(n) === 'complete'" class="hole-progress__check" aria-hidden="true" />
        </router-link>
      </div>

      <router-link
        :to="`/games/${gameId}/${nextNewHole}`"
        class="hole-progress__chip hole-progress__chip--add"
        :aria-label="$t('General.Hole') + ' +1'"
      >
        <PlusIcon class="w-3.5 h-3.5" />
      </router-link>
    </div>

    <!-- Spieler-Karten -->
    <section v-if="players.length === 0" class="hole-view__loading">
      {{ $t('Scorecard.Loading') }}
    </section>

    <section v-else class="hole-players">
      <article
        v-for="player in players"
        :key="player.id"
        class="player-tile"
        :class="{ 'player-tile--missing': !hasCurrentScore(player.id) }"
        :style="{ '--player-accent': colorMap[player.id]?.color }"
      >
        <div class="player-tile__identity">
          <PlayerAvatar
            :name="player.name"
            :color="colorMap[player.id]?.color"
            size="md"
          />
          <h2 class="player-tile__name" :title="player.name">{{ player.name }}</h2>
        </div>

        <div class="player-tile__controls">
          <button
            @click="changeStrokes(player.id, -1)"
            class="stroke-btn"
            :aria-label="$t('General.FewerStrokes')"
            type="button"
          >
            <MinusIcon class="w-6 h-6" />
          </button>

          <button
            type="button"
            :ref="el => setScoreRef(player.id, el as HTMLElement | null)"
            class="stroke-value"
            :class="{ 'is-saving': savingMap[player.id] }"
            @click="openKeypad(player.id)"
            :aria-label="$t('Games.HoleView.ScoreFor', { player: player.name }) + ': ' + (hasCurrentScore(player.id) ? scores[player.id]?.[hole] : $t('Games.HoleView.MissingScore'))"
            :aria-busy="savingMap[player.id] || undefined"
          >
            {{ hasCurrentScore(player.id) ? scores[player.id]?.[hole] : '–' }}
          </button>

          <button
            @click="changeStrokes(player.id, 1)"
            class="stroke-btn"
            :aria-label="$t('General.MoreStrokes')"
            type="button"
          >
            <PlusIcon class="w-6 h-6" />
          </button>
        </div>
      </article>
    </section>

    <!-- Keypad Sheet: Quick-Row (1-7) prominent, Extremwerte als native
         <details>-Disclosure. Tastatur-Shortcuts für Desktop. -->
    <AppBottomSheet
      v-model="keypadOpen"
      :title="keypadPlayer?.name || ''"
      :label="$t('Games.HoleView.OpenKeypad')"
    >
      <div class="keypad">
        <div class="keypad__section">
          <h3 class="t-eyebrow keypad__label">{{ $t('Games.HoleView.KeypadQuickTitle') }}</h3>
          <div class="keypad__grid keypad__grid--quick">
            <button
              v-for="n in quickRange"
              :key="'q-' + n"
              type="button"
              :class="['keypad__btn', { 'is-selected': keypadValue === n }]"
              @click="selectKeypadValue(n)"
            >
              {{ n }}
            </button>
          </div>
          <p class="keypad__shortcut-hint">{{ $t('Games.HoleView.KeypadShortcutHint') }}</p>
        </div>

        <details class="keypad__details">
          <summary class="keypad__summary">
            <ChevronDownIcon class="w-4 h-4 keypad__summary-chevron" />
            <span>{{ $t('Games.HoleView.KeypadShowAll') }}</span>
          </summary>
          <div class="keypad__grid">
            <button
              v-for="n in advancedRange"
              :key="'a-' + n"
              type="button"
              :class="['keypad__btn keypad__btn--compact', { 'is-selected': keypadValue === n }]"
              @click="selectKeypadValue(n)"
            >
              {{ n }}
            </button>
          </div>
        </details>
      </div>
    </AppBottomSheet>

    <ShareGameSheet v-model="shareOpen" :game-id="gameId" :game-name="gameName" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useScoreSyncStore } from '@/stores/scoreSync'
import { usePlayerColors } from '@/composables/usePlayerColors'
import { useHoleCompletion } from '@/composables/useHoleCompletion'
import { gamesDetailKey } from '@/types'
import { scoreKey } from '@/utils/mergeScores'
import { shortGameName } from '@/utils/format'
import { VALIDATION } from '@/constants'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import PlayerAvatar from '@/components/ui/PlayerAvatar.vue'
import ShareGameSheet from '@/components/games/ShareGameSheet.vue'
import {
  MinusIcon, PlusIcon,
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
  PencilSquareIcon, CheckIcon, ShareIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const gameId = computed(() => route.params.gameId as string)
const hole = computed(() => parseInt(route.params.holeId as string))

// Guard gegen ungültige Loch-Nummern in der URL (z. B. /games/:id/NaN aus einem
// veralteten Link oder einer korrupten Weiter-Navigation). Ohne diese Umleitung
// landet NaN über saveScore in der holes-Liste und die Scorecard zeigt eine
// "NaN"-Kachel für ein nie gespieltes Loch.
watch(hole, (h) => {
  if (Number.isInteger(h) && h >= VALIDATION.HOLE_MIN && h <= VALIDATION.HOLE_MAX) return
  const safe = Number.isFinite(h)
    ? Math.min(VALIDATION.HOLE_MAX, Math.max(VALIDATION.HOLE_MIN, h))
    : VALIDATION.HOLE_MIN
  void router.replace(`/games/${gameId.value}/${safe}`)
}, { immediate: true })

const context = inject(gamesDetailKey)!
const { players, scores, holes, gameName, lockedScores } = context
const { saveScore: saveScoreOffline } = useScoreSyncStore()
const { colorMap } = usePlayerColors(players)
const { hasScore, holeState } = useHoleCompletion(players, scores)

const displayName = computed(() => shortGameName(gameName.value))
const shareOpen = ref(false)

function hasCurrentScore(playerId: string) {
  return hasScore(playerId, hole.value)
}

/** Pill-Zustand eines Lochs für die Fortschrittsleiste. */
function holeStateFor(holeNum: number) {
  return holeState(holeNum)
}

/** Beschreibt den Pill-Zustand für Screenreader (nicht nur farblich). */
function pillAriaLabel(holeNum: number) {
  const state = holeState(holeNum)
  if (state === 'complete') return t('Games.HoleView.PillComplete', { n: holeNum })
  if (state === 'partial') return t('Games.HoleView.PillPartial', { n: holeNum })
  return `${t('General.Hole')} ${holeNum}`
}

const strokeRange = computed(() => {
  const { STROKES_MIN: min, STROKES_MAX: max } = VALIDATION
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
})

/** Typische Scores im Urban-Golf — Quick-Row ohne Scrollen erreichbar. */
const quickRange = [1, 2, 3, 4, 5, 6, 7]
/** Extremwerte nur auf Abruf — negativ (< 1) und hohe Fehlschläge. */
const advancedRange = computed(() => strokeRange.value.filter((n) => !quickRange.includes(n)))

const nextNewHole = computed(() => {
  const max = holes.value.length ? Math.max(...holes.value) : 0
  return Math.min(VALIDATION.HOLE_MAX, max + 1)
})

// Score element refs for pulse animation
const scoreRefs: Record<string, HTMLElement | null> = {}
function setScoreRef(playerId: string, el: HTMLElement | null) {
  scoreRefs[playerId] = el
}

function triggerPulse(playerId: string) {
  const el = scoreRefs[playerId]
  if (!el) return
  el.classList.remove('score-pop')
  void el.offsetWidth
  el.classList.add('score-pop')
}

function hapticFeedback() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

// Keypad
const keypadOpen = ref(false)
const keypadPlayerId = ref<string | null>(null)
const keypadPlayer = computed(() =>
  players.value.find(p => p.id === keypadPlayerId.value) || null
)
const keypadValue = computed(() =>
  keypadPlayerId.value ? Number(scores.value[keypadPlayerId.value]?.[hole.value]) || null : null
)

function openKeypad(playerId: string) {
  keypadPlayerId.value = playerId
  keypadOpen.value = true
}

function selectKeypadValue(n: number) {
  if (!keypadPlayerId.value) return
  scores.value[keypadPlayerId.value][hole.value] = n
  triggerPulse(keypadPlayerId.value)
  hapticFeedback()
  queueSave(keypadPlayerId.value)
  keypadOpen.value = false
}

/**
 * Desktop-Tastatur-Shortcuts im Keypad-Sheet:
 *   · Zifferntaste 1–9  → direkter Score
 *   · Pfeil-Hoch         → aktuellen Score +1
 *   · Pfeil-Runter       → aktuellen Score -1
 */
function onKeypadKey(e: KeyboardEvent) {
  if (!keypadOpen.value || !keypadPlayerId.value) return
  // Ignoriere wenn ein Eingabefeld fokussiert ist
  const tag = (document.activeElement as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.key >= '1' && e.key <= '9') {
    const n = Number(e.key)
    if (n >= VALIDATION.STROKES_MIN && n <= VALIDATION.STROKES_MAX) {
      e.preventDefault()
      selectKeypadValue(n)
    }
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const current = keypadValue.value ?? 0
    const next = Math.min(VALIDATION.STROKES_MAX, current + 1)
    selectKeypadValue(next)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const current = keypadValue.value ?? 0
    const next = Math.max(VALIDATION.STROKES_MIN, current - 1)
    selectKeypadValue(next)
    return
  }
}

// Swipe gestures for hole navigation
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2) {
    if (dx < 0) {
      router.push(`/games/${gameId.value}/${hole.value + 1}`)
    } else if (dx > 0 && hole.value > 1) {
      router.push(`/games/${gameId.value}/${hole.value - 1}`)
    }
  }
}

// Score-Felder bei Player-Liste-Änderung neu initialisieren
watch(() => players.value.length, () => ensureScoreFieldsExist())

function changeStrokes(playerId: string, delta: number) {
  const current = Number(scores.value[playerId]?.[hole.value]) || 0
  let updated = current + delta
  if (updated < VALIDATION.STROKES_MIN) updated = VALIDATION.STROKES_MIN
  if (updated > VALIDATION.STROKES_MAX) updated = VALIDATION.STROKES_MAX
  if (!scores.value[playerId]) scores.value[playerId] = {}
  scores.value[playerId][hole.value] = updated
  triggerPulse(playerId)
  hapticFeedback()
  queueSave(playerId)
}

// Rein visueller Saving-State pro Spieler (dämpft den Score während des
// Requests). Die Buttons bleiben bedienbar — das schnelle Zählen wird nie
// blockiert, weil Eingaben sofort lokal wirken.
const savingMap = ref<Record<string, boolean>>({})

// Debounced, coalesced Speicherung pro (Spieler, Loch): Taps wirken sofort
// lokal, aber erst nach kurzer Ruhe wird der ZULETZT getippte Wert einmal ans
// Backend geschickt. Kein Request-Sturm, keine gesperrten Buttons.
const SAVE_DEBOUNCE_MS = 400
type PendingSave = { playerId: string; hole: number; timer: ReturnType<typeof setTimeout> }
const pendingSaves = new Map<string, PendingSave>()
const inFlight = new Set<string>()

function queueSave(playerId: string) {
  const h = hole.value
  const lockKey = scoreKey(playerId, h)
  // Feld sofort gegen Live-Overwrite sperren — bleibt gesperrt bis der Save
  // durch ist und kein neuer Tap mehr aussteht.
  lockedScores.value.add(lockKey)

  const existing = pendingSaves.get(lockKey)
  if (existing) clearTimeout(existing.timer)
  const timer = setTimeout(() => void runSave(lockKey), SAVE_DEBOUNCE_MS)
  pendingSaves.set(lockKey, { playerId, hole: h, timer })
}

async function runSave(lockKey: string) {
  const entry = pendingSaves.get(lockKey)
  if (!entry) return
  // Läuft für dieses Feld noch ein Request, kurz warten und erneut versuchen —
  // so bleibt die Reihenfolge pro Feld erhalten (kein Out-of-order-Overwrite).
  if (inFlight.has(lockKey)) {
    entry.timer = setTimeout(() => void runSave(lockKey), SAVE_DEBOUNCE_MS)
    return
  }
  pendingSaves.delete(lockKey)
  const { playerId, hole: h } = entry
  inFlight.add(lockKey)
  savingMap.value[playerId] = true
  try {
    await saveScoreOffline({
      game_id: gameId.value,
      player_id: playerId,
      hole: h,
      strokes: Number(scores.value[playerId][h]),
    })
    // Erst NACHDEM ein Score gespeichert ist, tauchen wir das Loch in der
    // geteilten holes-Liste auf — so erscheint ein "weitergeblättertes" Loch
    // OHNE eingegebenen Score weder in der Scorecard noch im Pill-Strip.
    if (Number.isInteger(h) && !holes.value.includes(h)) {
      holes.value = [...holes.value, h].sort((a, b) => a - b)
    }
  } finally {
    inFlight.delete(lockKey)
    savingMap.value[playerId] = false
    // Lock nur lösen, wenn zwischenzeitlich kein neuer Tap einen weiteren Save
    // eingeplant hat.
    if (!pendingSaves.has(lockKey)) lockedScores.value.delete(lockKey)
  }
}

// Ausstehende Saves sofort committen (bei Loch-Wechsel / Verlassen der View),
// damit ein schnelles Weiterblättern nichts verliert.
function flushPendingSaves() {
  for (const [lockKey, entry] of [...pendingSaves]) {
    clearTimeout(entry.timer)
    void runSave(lockKey)
  }
}

// Loch-Pills: aktives Chip beim Hole-Wechsel horizontal zentrieren
const pillsRef = ref<HTMLElement | null>(null)
const pillRefs = new Map<number, HTMLElement>()

function setPillRef(holeNum: number, el: { $el?: HTMLElement } | HTMLElement | null) {
  if (!el) {
    pillRefs.delete(holeNum)
    return
  }
  const node = el instanceof HTMLElement ? el : el.$el
  if (node) pillRefs.set(holeNum, node)
}

function scrollCurrentPillIntoView() {
  const el = pillRefs.get(hole.value)
  if (!el) return
  // Center-Scroll nur horizontal innerhalb des Pill-Containers
  el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
}

watch(() => hole.value, () => {
  // Vor dem Loch-Wechsel noch ausstehende Saves des alten Lochs committen.
  flushPendingSaves()
  ensureScoreFieldsExist()
  // Nach dem Render der neuen Route den Pill scrollen
  requestAnimationFrame(() => scrollCurrentPillIntoView())
})

onMounted(() => {
  requestAnimationFrame(() => scrollCurrentPillIntoView())
  window.addEventListener('keydown', onKeypadKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeypadKey)
  // Nicht verworfene Eingaben beim Verlassen der View noch persistieren.
  flushPendingSaves()
})

function ensureScoreFieldsExist() {
  // Legt nur lokale Score-Slots an, damit die Inputs rendern können.
  // Das Loch wird NICHT in holes.value eingefügt — das passiert erst beim
  // ersten erfolgreichen Save (siehe saveScore).
  for (const player of players.value) {
    if (!scores.value[player.id]) scores.value[player.id] = {}
    if (scores.value[player.id][hole.value] === undefined) {
      scores.value[player.id][hole.value] = ''
    }
  }
}
</script>

<style scoped>
.hole-view {
  padding-top: 0.5rem;
  /* Bottom-Nav wird vom Layout via app-main padding-bottom reserviert — hier
     reicht minimales padding-bottom für Atemraum nach dem letzten Tile. */
  padding-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Breadcrumb-Link: deutlicher Rückweg zur Scorecard. Darf bei langen
   Spielnamen die ganze Zeile einnehmen. */
.hole-view__breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem 0.45rem 0.6rem;
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, var(--primary) 10%, transparent);
  color: var(--primary);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 600;
  min-height: 2.5rem;
  transition: background 150ms, color 150ms, outline-color 150ms;
  max-width: 100%;
  width: fit-content;
}

.hole-view__breadcrumb:hover {
  background: color-mix(in oklab, var(--primary) 18%, transparent);
}

.hole-view__breadcrumb:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.hole-view__breadcrumb-sep {
  color: color-mix(in oklab, var(--primary) 60%, transparent);
  margin-inline: 0.15rem;
  flex-shrink: 0;
}

.hole-view__breadcrumb-context {
  color: var(--text-muted);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  /* Wächst mit dem verfügbaren Raum — kann bei langen Namen mehr zeigen */
  flex: 1 1 auto;
}

.hole-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.hole-header__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.hole-header__title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  line-height: 1;
  min-width: 0;
}

.hole-header__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hole-header__number {
  font-family: var(--font-display);
  /* Reduzierter Header — gibt mehr Raum für Spieler-Tiles frei */
  font-size: clamp(2rem, 8vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--text-strong);
  line-height: 0.9;
  font-variant-numeric: tabular-nums;
}

/* Loch-Pills + Add-Button teilen sich eine Reihe */
.hole-progress-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* Progress pills — wachsen nicht (bleiben links, "+1" direkt daneben),
   schrumpfen aber und scrollen, wenn viele Löcher nicht mehr passen. */
.hole-progress {
  flex: 0 1 auto;
  min-width: 0;
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-block: 0.25rem;
  scroll-snap-type: x mandatory;
}

.hole-progress__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  padding-inline: 0.75rem;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--text-sm);
  scroll-snap-align: start;
  flex-shrink: 0;
  transition: transform 120ms var(--ease-spring), background 150ms, color 150ms;
}

.hole-progress__chip:active { transform: scale(0.94); }

/* Teilweise erfasst: mindestens ein, aber nicht alle Spieler. */
.hole-progress__chip.is-partial {
  color: var(--primary);
  background: color-mix(in oklab, var(--primary) 12%, var(--card-bg));
  border-color: color-mix(in oklab, var(--primary) 22%, var(--card-border));
}

/* Vollständig für alle Spieler: Success-Tint + Häkchen (nicht nur farblich). */
.hole-progress__chip.is-complete {
  color: color-mix(in oklab, var(--color-success-600) 85%, var(--text-strong));
  background: color-mix(in oklab, var(--color-success-500) 16%, var(--card-bg));
  border-color: color-mix(in oklab, var(--color-success-500) 32%, var(--card-border));
  padding-inline: 0.55rem 0.5rem;
}

:root.dark .hole-progress__chip.is-complete {
  color: var(--color-success-400);
}

.hole-progress__check {
  width: 0.9rem;
  height: 0.9rem;
  margin-left: 0.15rem;
  flex-shrink: 0;
  stroke-width: 2.5;
}

.hole-progress__chip.is-current {
  color: var(--primary-ink);
  background: var(--primary);
  border-color: var(--primary);
  box-shadow: var(--shadow-elev-1);
}

.hole-progress__chip--add {
  color: var(--text-muted);
  background: color-mix(in oklab, var(--text-default) 6%, transparent);
  border-style: dashed;
}

/* Player tiles */
.hole-players {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Single-Row Tile: Identity links, Controls rechts — passt 5+ Spieler auf einen Screen */
.player-tile {
  --player-accent: var(--color-player-1);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "identity controls";
  gap: 0.75rem;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elev-1);
  position: relative;
  overflow: hidden;
  transition: background 240ms var(--ease-standard);
}

.player-tile::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  /* Breiter Balken + subtile Tint-Fläche — Glow dezenter, damit bei 4+ Tiles
     die Akzente nicht visuell dominieren. */
  width: 5px;
  background: var(--player-accent);
  border-radius: 0 3px 3px 0;
  box-shadow: 3px 0 10px -4px color-mix(in oklab, var(--player-accent) 25%, transparent);
  transition: opacity 240ms var(--ease-standard);
}

:root.dark .player-tile::before {
  /* Im Dark-Mode ist die Akzent-Chroma ohnehin höher — Glow noch einen Tick
     subtiler, damit es nicht "leuchtet". */
  box-shadow: 3px 0 8px -5px color-mix(in oklab, var(--player-accent) 20%, transparent);
}

/* Loch noch nicht für diesen Spieler erfasst: ruhige, "wartende" Kachel.
   Der farbige Akzentbalken leuchtet erst beim Erfassen voll auf und der
   "–"-Wert ist gedämpft — kein Badge, damit der Name nie verdeckt wird. */
.player-tile--missing {
  background: color-mix(in oklab, var(--text-default) 4%, var(--card-bg));
}

.player-tile--missing::before {
  opacity: 0.4;
}

.player-tile--missing .stroke-value {
  color: var(--text-muted);
}

.player-tile__identity {
  grid-area: identity;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding-left: 0.3rem;
}

.player-tile__name {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.player-tile__controls {
  grid-area: controls;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stroke-btn {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  background: color-mix(in oklab, var(--player-accent) 16%, var(--card-bg));
  color: color-mix(in oklab, var(--player-accent) 65%, var(--text-strong));
  border: 1px solid color-mix(in oklab, var(--player-accent) 30%, var(--card-border));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 120ms var(--ease-spring), background 150ms, color 150ms;
  flex-shrink: 0;
}

.stroke-btn:active { transform: scale(0.9); }
.stroke-btn:hover {
  background: color-mix(in oklab, var(--player-accent) 24%, var(--card-bg));
  color: var(--text-strong);
}

.stroke-value {
  min-width: 2.5ch;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  line-height: 1;
  color: var(--text-strong);
  background: transparent;
  border: 0;
  padding: 0.15rem 0.2rem;
  border-radius: var(--radius-md);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  text-align: center;
  transition: background 150ms, color 150ms, transform 100ms var(--ease-spring);
  cursor: pointer;
}

.stroke-value:hover {
  background: color-mix(in oklab, var(--player-accent) 10%, transparent);
}

/* Inline Hole-Stepper rechts + links um die Nummer. iOS-Kalender-Pattern. */
.hole-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.hole-stepper__btn {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-default);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 150ms, border-color 150ms, background 150ms, transform 120ms var(--ease-spring);
  flex-shrink: 0;
}

/* Dark-Mode: Standard-card-border ist sehr subtil, für Action-Buttons
   brauchen wir mehr Kontrast, sonst verschwimmen sie im Hintergrund. */
:root.dark .hole-stepper__btn {
  border-color: color-mix(in oklab, var(--color-surface-0) 22%, transparent);
  background: color-mix(in oklab, var(--color-surface-0) 5%, var(--card-bg));
}

.hole-stepper__btn:hover {
  color: var(--primary);
  border-color: var(--primary);
}

.hole-stepper__btn:active { transform: scale(0.92); }

/* Auf Loch 1 behält der Zurück-Button seinen Platz (stabile Stepper-Breite),
   ist aber visuell versteckt und nicht bedienbar. */
.hole-stepper__btn.is-disabled {
  visibility: hidden;
  pointer-events: none;
}

.hole-stepper__btn:disabled {
  opacity: 0.35;
  pointer-events: none;
}

.hole-view__loading {
  padding: 3rem 0;
  text-align: center;
  color: var(--text-muted);
}

/* Keypad */
.keypad {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-bottom: 0.5rem;
}

.keypad__section { display: flex; flex-direction: column; gap: 0.5rem; }

.keypad__label {
  margin: 0;
}

/* Hint: nur auf Geräten mit richtiger Tastatur sinnvoll (hover: hover deutet auf Desktop) */
.keypad__shortcut-hint {
  display: none;
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: 0.1rem;
  text-align: center;
}

@media (hover: hover) and (min-width: 768px) {
  .keypad__shortcut-hint { display: block; }
}

.keypad__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.keypad__grid--quick {
  grid-template-columns: repeat(4, 1fr);
}

@media (min-width: 420px) {
  .keypad__grid { grid-template-columns: repeat(5, 1fr); }
  .keypad__grid--quick { grid-template-columns: repeat(7, 1fr); }
}

.keypad__btn {
  height: 3.5rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: transform 120ms var(--ease-spring), border-color 150ms, background 150ms;
}

.keypad__btn--compact {
  height: 2.75rem;
  font-size: var(--text-lg);
}

.keypad__btn:active { transform: scale(0.94); }
.keypad__btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.keypad__btn.is-selected {
  background: var(--primary);
  color: var(--primary-ink);
  border-color: var(--primary);
}

/* Native <details>: Summary wird als echter Toggle vom Screenreader angekündigt */
.keypad__details {
  align-self: center;
  width: 100%;
}
.keypad__details > summary { list-style: none; }
.keypad__details > summary::-webkit-details-marker { display: none; }

.keypad__summary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  min-height: 2.75rem;
  border-radius: var(--radius-pill);
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  margin-inline: auto;
  margin-bottom: 0.6rem;
  transition: color 150ms, border-color 150ms;
}

.keypad__details[open] > summary {
  color: var(--text-strong);
  border-color: var(--text-default);
}

.keypad__summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.keypad__summary:hover {
  color: var(--text-strong);
  border-color: var(--text-default);
}

.keypad__summary-chevron {
  transition: transform 220ms var(--ease-standard);
}

.keypad__details[open] .keypad__summary-chevron {
  transform: rotate(180deg);
}

/* Loading-State für Score-Button während Save */
.stroke-value.is-saving {
  opacity: 0.55;
  pointer-events: none;
}
</style>
