<template>
  <BackgroundImage />
  <router-view />
  <ToastContainer />
  <SyncStatusIndicator />
  <AuthSheet />
  <PWAUpdateDialog />
  <PWAInstallBanner />
</template>

<script setup lang="ts">
import BackgroundImage from '@/components/ui/BackgroundImage.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import SyncStatusIndicator from '@/components/layout/SyncStatusIndicator.vue'
import AuthSheet from '@/components/auth/AuthSheet.vue'
import PWAUpdateDialog from '@/components/pwa/PWAUpdateDialog.vue'
import PWAInstallBanner from '@/components/pwa/PWAInstallBanner.vue'
import { useScoreSyncStore } from '@/stores/scoreSync'
import { useThemeMode } from '@/composables/useThemeMode'
import { useAuthStore } from '@/stores/auth'

useScoreSyncStore().installNetworkWatcher()
useThemeMode()
// Bestehende Session (optional) beim Start wiederherstellen.
void useAuthStore().loadMe()
</script>
