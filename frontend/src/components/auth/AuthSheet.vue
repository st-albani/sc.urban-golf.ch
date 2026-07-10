<template>
  <AppBottomSheet
    :model-value="auth.loginOpen"
    :label="$t('Auth.Title')"
    :title="$t('Auth.Title')"
    @update:model-value="onSheet"
  >
    <div class="auth">
      <template v-if="step === 'email'">
        <p class="auth__lead t-muted">{{ $t('Auth.EmailLead') }}</p>
        <label class="t-eyebrow auth__label" for="auth-email">{{ $t('Auth.EmailLabel') }}</label>
        <input
          id="auth-email"
          v-model="email"
          class="field"
          type="email"
          inputmode="email"
          autocomplete="email"
          :placeholder="$t('Auth.EmailPlaceholder')"
          @keydown.enter="submitEmail"
        />
        <AppButton
          variant="primary"
          size="lg"
          block
          pill
          :loading="busy"
          :disabled="!emailValid"
          @click="submitEmail"
        >
          {{ $t('Auth.RequestCode') }}
        </AppButton>
      </template>

      <template v-else>
        <p class="auth__lead t-muted">{{ $t('Auth.CodeLead', { email }) }}</p>
        <label class="t-eyebrow auth__label" for="auth-code">{{ $t('Auth.CodeLabel') }}</label>
        <input
          id="auth-code"
          v-model="code"
          class="field auth__code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          :placeholder="$t('Auth.CodePlaceholder')"
          @keydown.enter="submitCode"
        />
        <p v-if="error" class="auth__error" role="alert">{{ $t('Auth.InvalidCode') }}</p>
        <AppButton
          variant="primary"
          size="lg"
          block
          pill
          :loading="busy"
          :disabled="code.trim().length < 4"
          @click="submitCode"
        >
          {{ $t('Auth.SignIn') }}
        </AppButton>
        <div class="auth__secondary">
          <button type="button" class="auth__link" :disabled="busy" @click="resend">
            {{ $t('Auth.Resend') }}
          </button>
          <button type="button" class="auth__link" :disabled="busy" @click="backToEmail">
            {{ $t('Auth.ChangeEmail') }}
          </button>
        </div>
      </template>
    </div>
  </AppBottomSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { EMAIL_PATTERN } from '@/constants'

const { t } = useI18n()
const auth = useAuthStore()
const { success } = useToast()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const busy = ref(false)
const error = ref(false)

const emailValid = computed(() => EMAIL_PATTERN.test(email.value.trim()))

async function submitEmail() {
  if (!emailValid.value || busy.value) return
  busy.value = true
  try {
    await auth.requestOtp(email.value.trim())
    step.value = 'code'
  } finally {
    busy.value = false
  }
}

async function submitCode() {
  if (code.value.trim().length < 4 || busy.value) return
  busy.value = true
  error.value = false
  try {
    await auth.verifyOtp(email.value.trim(), code.value.trim())
    success(t('Auth.SignedIn'))
    auth.closeLogin()
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}

async function resend() {
  if (busy.value) return
  busy.value = true
  try {
    await auth.requestOtp(email.value.trim())
  } finally {
    busy.value = false
  }
}

function backToEmail() {
  step.value = 'email'
  code.value = ''
  error.value = false
}

function onSheet(open: boolean) {
  if (open) auth.openLogin()
  else auth.closeLogin()
}

watch(
  () => auth.loginOpen,
  (open) => {
    if (!open) {
      step.value = 'email'
      code.value = ''
      error.value = false
      busy.value = false
    }
  },
)
</script>

<style scoped>
.auth {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding-bottom: 0.25rem;
}

.auth__lead {
  font-size: var(--text-sm);
}

.auth__label {
  margin: 0.15rem 0 -0.35rem;
}

.auth__code {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: 0.35em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.auth__error {
  font-size: var(--text-sm);
  color: var(--color-danger-500);
  font-weight: 600;
}

.auth__secondary {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.15rem;
}

.auth__link {
  background: none;
  border: 0;
  padding: 0.35rem 0.1rem;
  color: var(--primary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.auth__link:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
