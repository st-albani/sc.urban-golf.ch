<template>
  <BackgroundImage />
  <router-view />
  <ToastContainer />
  <SyncStatusIndicator />
  <PWAUpdateDialog />
  <PWAInstallBanner />
</template>

<script setup lang="ts">
import BackgroundImage from '@/components/ui/BackgroundImage.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import SyncStatusIndicator from '@/components/layout/SyncStatusIndicator.vue'
import PWAUpdateDialog from '@/components/pwa/PWAUpdateDialog.vue'
import PWAInstallBanner from '@/components/pwa/PWAInstallBanner.vue'
import { useScoreSyncStore } from '@/stores/scoreSync'
import { useThemeMode } from '@/composables/useThemeMode'

useScoreSyncStore().installNetworkWatcher()
useThemeMode()
</script>
