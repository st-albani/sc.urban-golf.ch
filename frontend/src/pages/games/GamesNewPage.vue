<template>
  <DefaultLayout>
    <div class="container-app new-game">
      <header class="new-game__header">
        <h1 class="t-headline">
          {{ isEditing ? $t('Games.NewGame.TitleEdit') : $t('Games.NewGame.TitleNew') }}
        </h1>
        <p class="t-muted">{{ $t('Games.NewGame.Subtitle') }}</p>
      </header>

      <section class="new-game__card">
        <div class="new-game__group">
          <label class="label-strong" for="game-name">{{ $t('Games.NewGame.GameName') }}</label>
          <input
            id="game-name"
            type="text"
            v-model="gameName"
            :placeholder="$t('Games.NewGame.GameNamePlaceholder')"
            maxlength="30"
            class="field"
          />
        </div>

        <div class="new-game__group">
          <label class="label-strong">
            {{ $t('General.Player') }}
            <span class="new-game__count">{{ players.length }}/10</span>
          </label>

          <transition-group tag="ul" name="list" class="new-game__players">
            <li
              v-for="(player, index) in players"
              :key="player.id"
              class="new-game__player"
              :class="{ 'new-game__player--self': isSelf(player) }"
              :style="{ '--player-accent': playerColor(index) }"
            >
              <span class="new-game__player-index">{{ index + 1 }}</span>

              <div v-if="isSelf(player)" class="new-game__self">
                <PlayerAvatar
                  :name="player.name || $t('Games.NewGame.You')"
                  :src="auth.avatar"
                  size="sm"
                  :color="playerColor(index)"
                />
                <span class="new-game__self-name">{{ player.name }}</span>
                <span class="new-game__self-badge">{{ $t('Games.NewGame.You') }}</span>
              </div>
              <input
                v-else
                type="text"
                v-model="player.name"
                :placeholder="$t('Games.NewGame.PlayerNamePlaceholder')"
                maxlength="30"
                class="field new-game__player-input"
              />

              <button
                type="button"
                class="new-game__remove"
                :aria-label="`${$t('Games.NewGame.RemovePlayer')} ${index + 1}`"
                @click="removePlayer(player.id)"
                :disabled="players.length <= 1"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </li>
          </transition-group>

          <button
            v-if="canAddSelf"
            type="button"
            class="new-game__add-self"
            @click="addSelfRow"
          >
            <UserIcon class="w-4 h-4" />
            {{ $t('Games.NewGame.AddYou') }}
          </button>

          <AppButton
            variant="secondary"
            size="md"
            pill
            block
            :disabled="players.length >= 10"
            @click="addPlayer"
          >
            <template #icon-left>
              <PlusIcon class="w-5 h-5" />
            </template>
            {{ $t('Games.NewGame.AddPlayer') }}
          </AppButton>
        </div>
      </section>

      <div class="new-game__cta">
        <AppButton
          variant="accent"
          size="xl"
          pill
          block
          :loading="isSaving"
          @click="saveGame"
        >
          <template #icon-left>
            <PlayIcon v-if="!isEditing" class="w-5 h-5" />
            <CheckIcon v-else class="w-5 h-5" />
          </template>
          {{ isEditing ? $t('Games.NewGame.SaveChanges') : $t('Games.NewGame.StartGame') }}
        </AppButton>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { nanoid } from 'nanoid'
import { useToast } from '@/composables/useToast'
import { fetchGame, fetchGamePlayers, createOrUpdatePlayers, createOrUpdateGame } from '@/services/api'
import { PlusIcon, TrashIcon, PlayIcon, CheckIcon, UserIcon } from '@heroicons/vue/24/outline'
import PlayerAvatar from '@/components/ui/PlayerAvatar.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { error: showError } = useToast()
const auth = useAuthStore()
const gameId = computed(() => route.params.gameId as string | undefined)

const gameName = ref('')
const players = ref([{ id: nanoid(), name: '' }])
const isEditing = computed(() => !!gameId.value)
const isSaving = ref(false)

// Selbst-Markierung: ist der Nutzer eingeloggt mit kanonischer Identität,
// wird die erste Zeile zur „Du"-Zeile — mit der stabilen Spieler-ID, damit
// die Runde spielübergreifend korrekt der eigenen Statistik zugeordnet wird.
// Der Name bleibt read-only (Änderung nur im Profil, sonst würde die kanonische
// Identität versehentlich umbenannt). Optional: entfernbar (Scorekeeper) und
// wieder hinzufügbar.
function isSelf(player: { id: string }) {
  return !!auth.playerId && player.id === auth.playerId
}

const hasSelfRow = computed(() => players.value.some(isSelf))
const canAddSelf = computed(() => !isEditing.value && !!auth.playerId && !hasSelfRow.value)

function addSelfRow() {
  if (!auth.playerId || hasSelfRow.value) return
  const meRow = { id: auth.playerId, name: auth.displayName || '' }
  // Eine noch leere Einzelzeile ersetzen, sonst voranstellen.
  if (players.value.length === 1 && players.value[0].name === '' && !isSelf(players.value[0])) {
    players.value = [meRow]
  } else {
    players.value.unshift(meRow)
  }
}

// Beim Öffnen eines neuen Spiels die „Du"-Zeile automatisch anbieten.
onMounted(() => { if (canAddSelf.value) addSelfRow() })
watch(() => auth.playerId, () => { if (canAddSelf.value) addSelfRow() })

async function loadGame(id: string) {
  try {
    const game = await fetchGame(id)
    gameName.value = game?.name || ''
    const existing = await fetchGamePlayers(id)
    players.value = existing.map(p => ({ id: p.id, name: p.name }))
    if (players.value.length === 0) players.value = [{ id: nanoid(), name: '' }]
  } catch (err) {
    console.error('Failed to load game:', err)
    showError(t('Games.NewGame.Errors.LoadFailed'))
  }
}

watchEffect(async () => {
  if (gameId.value) await loadGame(gameId.value)
})

function addPlayer() {
  if (players.value.length < 10) {
    players.value.push({ id: nanoid(), name: '' })
  }
}

function removePlayer(id: string) {
  if (players.value.length <= 1) return
  players.value = players.value.filter(p => p.id !== id)
}

const playerColors = [
  'var(--color-player-1)', 'var(--color-player-2)', 'var(--color-player-3)', 'var(--color-player-4)',
  'var(--color-player-5)', 'var(--color-player-6)', 'var(--color-player-7)', 'var(--color-player-8)',
]
function playerColor(idx: number) {
  return playerColors[idx % playerColors.length]
}

async function saveGame() {
  if (isSaving.value) return
  isSaving.value = true

  const validPlayers = players.value
    .map(p => ({ ...p, name: p.name.trim() }))
    .filter(p => p.name)

  if (!gameName.value || validPlayers.length === 0) {
    showError(t('Games.NewGame.Errors.GameAndPlayerRequired'))
    isSaving.value = false
    return
  }

  try {
    await createOrUpdatePlayers(validPlayers.map(p => ({ id: p.id, name: p.name })))
    const playerIds = validPlayers.map(p => p.id)
    const idToUse = isEditing.value ? gameId.value! : nanoid()
    const game = await createOrUpdateGame({ id: idToUse, name: gameName.value, players: playerIds })

    if (!game?.id) {
      showError(t('Games.NewGame.Errors.SaveFailed'))
      return
    }

    // Mark the creation of a new game as a natural moment to prompt PWA install
    if (!isEditing.value) {
      try {
        localStorage.setItem('ug-install-gamestart', String(Date.now()))
      } catch { /* ignore storage errors */ }
    }

    if (isEditing.value) {
      router.go(-1)
    } else {
      router.push(`/games/${game.id}/1`)
    }
  } catch (err) {
    console.error(err)
    showError(t('Games.NewGame.Errors.SaveFailed'))
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.new-game {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-block: 1.25rem 1.5rem;
}

.new-game__header { display: flex; flex-direction: column; gap: 0.35rem; }

.new-game__card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elev-1);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.new-game__group { display: flex; flex-direction: column; gap: 0.55rem; }

.new-game__count {
  float: right;
  font-weight: 500;
  color: var(--text-muted);
  font-size: var(--text-xs);
  letter-spacing: 0;
  text-transform: none;
}

.new-game__players {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.new-game__player {
  --player-accent: var(--color-player-1);
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.new-game__player-index {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: color-mix(in oklab, var(--player-accent) 18%, transparent);
  color: color-mix(in oklab, var(--player-accent) 70%, var(--text-strong));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--text-sm);
  border: 1px solid color-mix(in oklab, var(--player-accent) 30%, transparent);
}

.new-game__player-input { padding-block: 0.65rem; }

/* „Du"-Zeile: eigene Identität, Name nicht editierbar (nur im Profil änderbar). */
.new-game__self {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-md);
  border: 1px dashed color-mix(in oklab, var(--player-accent) 45%, transparent);
  background: color-mix(in oklab, var(--player-accent) 8%, transparent);
}

.new-game__self-name {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new-game__self-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--player-accent) 75%, var(--text-strong));
  background: color-mix(in oklab, var(--player-accent) 18%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-pill);
}

.new-game__add-self {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  align-self: flex-start;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-pill);
  border: 1px dashed var(--card-border);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: color 150ms, border-color 150ms;
}
.new-game__add-self:hover { color: var(--primary); border-color: var(--primary); }

.new-game__remove {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 150ms, border-color 150ms, background 150ms;
}

.new-game__remove:hover:not(:disabled) {
  color: var(--color-danger-500);
  border-color: var(--color-danger-500);
  background: color-mix(in oklab, var(--color-danger-500) 10%, transparent);
}

.new-game__remove:disabled { opacity: 0.4; cursor: not-allowed; }

.new-game__cta {
  position: sticky;
  bottom: calc(var(--spacing-nav-height) + var(--spacing-safe-bottom) + 0.5rem);
  z-index: 2;
}

@media (min-width: 768px) {
  .new-game__cta {
    bottom: 1rem;
  }
}
</style>
