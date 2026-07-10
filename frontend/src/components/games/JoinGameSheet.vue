<template>
  <AppBottomSheet
    :model-value="modelValue"
    :label="$t('Join.Title')"
    :title="$t('Join.Title')"
    @update:model-value="onSheet"
  >
    <div class="join">
      <div class="join__scanner" :class="{ 'is-active': scanning }">
        <video ref="videoRef" class="join__video" playsinline muted></video>
        <div v-if="!scanning" class="join__placeholder">
          <QrCodeIcon class="join__placeholder-icon" aria-hidden="true" />
        </div>
      </div>

      <AppButton v-if="!scanning" variant="primary" size="lg" block pill @click="startScan">
        <template #icon-left>
          <CameraIcon class="w-5 h-5" />
        </template>
        {{ $t('Join.StartCamera') }}
      </AppButton>
      <AppButton v-else variant="secondary" size="lg" block pill @click="stop">
        {{ $t('Join.StopCamera') }}
      </AppButton>

      <p v-if="error === 'denied'" class="join__hint">{{ $t('Join.CameraDenied') }}</p>
      <p v-else-if="error === 'unsupported'" class="join__hint">{{ $t('Join.CameraUnsupported') }}</p>

      <label class="t-eyebrow join__label" for="join-manual">{{ $t('Join.ManualLabel') }}</label>
      <div class="join__manual">
        <input
          id="join-manual"
          v-model="manual"
          class="field join__manual-input"
          type="text"
          :placeholder="$t('Join.ManualPlaceholder')"
          @keydown.enter="submitManual"
          @input="invalid = false"
        />
        <AppButton variant="secondary" size="md" pill @click="submitManual">
          {{ $t('Join.Submit') }}
        </AppButton>
      </div>
      <p v-if="invalid" class="join__hint join__hint--error" role="alert">{{ $t('Join.InvalidRef') }}</p>
    </div>
  </AppBottomSheet>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CameraIcon, QrCodeIcon } from '@heroicons/vue/24/outline'
import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useQrScanner } from '@/composables/useQrScanner'
import { parseGameRef } from '@/utils/gameRef'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const router = useRouter()
const videoRef = ref<HTMLVideoElement | null>(null)
const manual = ref('')
const invalid = ref(false)

const { scanning, error, start, stop } = useQrScanner(onDecoded)

function onDecoded(text: string) {
  const id = parseGameRef(text)
  if (id) join(id)
  else invalid.value = true
}

async function startScan() {
  invalid.value = false
  if (videoRef.value) await start(videoRef.value)
}

function submitManual() {
  const id = parseGameRef(manual.value)
  if (id) join(id)
  else invalid.value = true
}

function join(id: string) {
  stop()
  emit('update:modelValue', false)
  void router.push(`/games/${id}`)
}

function onSheet(open: boolean) {
  if (!open) stop()
  emit('update:modelValue', open)
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      stop()
      invalid.value = false
      manual.value = ''
    }
  },
)
</script>

<style scoped>
.join {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-bottom: 0.25rem;
}

.join__scanner {
  position: relative;
  aspect-ratio: 1 / 1;
  max-height: 15rem;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: color-mix(in oklab, var(--text-default) 8%, transparent);
  border: 1px solid var(--card-border);
}

.join__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
}

.join__scanner.is-active .join__video {
  display: block;
}

.join__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.join__placeholder-icon {
  width: 3.5rem;
  height: 3.5rem;
  opacity: 0.5;
}

.join__hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
}

.join__hint--error {
  color: var(--color-danger-500);
  font-weight: 600;
}

.join__label {
  margin: 0.35rem 0 -0.35rem;
}

.join__manual {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.join__manual-input {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
