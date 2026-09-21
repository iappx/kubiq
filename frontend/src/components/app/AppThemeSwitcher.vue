<template>
  <button
      :aria-label="appThemeStore.isDarkTheme ? 'Light theme' : 'Dark theme'"
      :title="appThemeStore.isDarkTheme ? 'Light theme' : 'Dark theme'"
      class="btn-icon"
      type="button"
      @click="switchTheme"
  >
    <sun v-if="appThemeStore.isDarkTheme" :size="18" />
    <moon v-else :size="18" />
  </button>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { Moon, Sun } from '@lucide/vue'
import { AppThemeStore } from '@/store/modules/appTheme/AppThemeStore'
import { inject } from 'tsyringe'

@Component({
  components: { Sun, Moon },
})
export default class AppThemeSwitcher extends VueBase {
  constructor(
      @inject(AppThemeStore) public readonly appThemeStore: AppThemeStore,
  ) {
    super()
  }

  switchTheme(): void {
    this.appThemeStore.toggleTheme()
  }
}
</script>
