<template>
  <header class="h-14 flex items-center justify-between px-4 bg-card border-b border-border shrink-0">
    <router-link to="/">
      <app-logo size="sm" />
    </router-link>

    <div class="flex items-center gap-1">
      <a
          v-if="docsUrl"
          :href="docsUrl"
          class="btn-icon"
          target="_blank"
          title="Documentation"
      >
        <circle-help :size="18" />
      </a>

      <app-theme-switcher />
    </div>
  </header>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import AppThemeSwitcher from '@/components/app/AppThemeSwitcher.vue'
import AppLogo from '@/components/app/AppLogo.vue'
import { CircleHelp } from '@lucide/vue'
import { AppEnvironment } from '@/config/AppEnvironment'

@Component({
  components: { CircleHelp, AppLogo, AppThemeSwitcher },
})
export default class TopNav extends VueBase {
  public get docsUrl(): string {
    return AppEnvironment.DocsUrl
  }
}
</script>
