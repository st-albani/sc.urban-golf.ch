<template>
  <AppBottomSheet
    :model-value="modelValue"
    :label="$t('Share.Title')"
    :title="$t('Share.Title')"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <div class="share">
      <!-- Transparenz: jeder mit dem Link kann mitschreiben. Bei privaten
           Spielen (Phase 1: ungelistet) ist der Link die einzige Zugangsschranke. -->
      <p class="share__notice">
        <InformationCircleIcon class="share__notice-icon" aria-hidden="true" />
        <span>{{ props.private ? $t('Share.EditWarningPrivate') : $t('Share.EditWarning') }}</span>
      </p>

      <!-- QR-Code: Mitspieler scannt mit dem Handy und ist sofort im Spiel -->
      <figure v-if="qrDataUrl" class="share__qr">
        <img
          :src="qrDataUrl"
          class="share__qr-img"
          :alt="$t('Share.QrAlt')"
          width="200"
          height="200"
        />
        <figcaption class="share__qr-hint">{{ $t('Share.ScanHint') }}</figcaption>
      </figure>

      <label class="t-eyebrow share__label" for="share-link">{{ $t('Share.LinkLabel') }}</label>
      <input
        id="share-link"
        class="field share__link"
        type="text"
        :value="shareUrl"
        readonly
        @focus="selectAll"
      />

      <div class="share__actions">
        <AppButton variant="secondary" size="lg" block pill @click="onCopy">
          <template #icon-left>
            <CheckIcon v-if="copied" class="w-5 h-5" />
            <ClipboardDocumentIcon v-else class="w-5 h-5" />
          </template>
          {{ copied ? $t('Share.Copied') : $t('Share.Copy') }}
        </AppButton>

        <AppButton v-if="canNativeShare" variant="primary" size="lg" block pill @click="onShare">
          <template #icon-left>
            <ShareIcon class="w-5 h-5" />
          </template>
          {{ $t('Share.Share') }}
        </AppButton>
      </div>
    </div>
  </AppBottomSheet>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  InformationCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ShareIcon,
} from '@heroicons/vue/24/outline'
import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useShareGame } from '@/composables/useShareGame'
import { useQrCode } from '@/composables/useQrCode'

const props = defineProps<{ modelValue: boolean; gameId: string; gameName: string; private?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t } = useI18n()
const { shareUrl, canNativeShare, copied, copyLink, nativeShare } = useShareGame(toRef(props, 'gameId'))
const { dataUrl: qrDataUrl } = useQrCode(shareUrl)

function onCopy() {
  void copyLink()
}

function onShare() {
  void nativeShare(props.gameName || t('Share.Title'))
}

function selectAll(e: FocusEvent) {
  ;(e.target as HTMLInputElement).select()
}
</script>

<style scoped>
.share {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-bottom: 0.25rem;
}

.share__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--primary) 10%, transparent);
  color: var(--text-default);
  font-size: var(--text-sm);
}

.share__notice-icon {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  color: var(--primary);
  margin-top: 0.05rem;
}

.share__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin: 0.15rem 0 0.35rem;
}

.share__qr-img {
  width: 200px;
  height: 200px;
  max-width: 60vw;
  max-height: 60vw;
  border-radius: var(--radius-md);
  background: #fff;
  padding: 0.5rem;
  box-shadow: var(--shadow-elev-1);
}

.share__qr-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: 600;
}

.share__label {
  margin: 0.15rem 0 -0.35rem;
}

.share__link {
  width: 100%;
  font-size: var(--text-sm);
  color: var(--text-default);
  overflow: hidden;
  text-overflow: ellipsis;
}

.share__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.35rem;
}
</style>
