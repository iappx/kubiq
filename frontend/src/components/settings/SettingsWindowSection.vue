<template>
  <ui-section title="Window">
    <ui-toggle
        v-model="closeToTrayValue"
        description="Closing the window keeps kubiq running in the notification area instead of quitting."
        label="Close to tray"
    />

    <p class="text-xs text-muted-foreground">
      Stored, but not acted on yet: the window close hook lives on the Go side.
    </p>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'

@Component({
  components: { UiSection, UiToggle },
  emits: ['update:close-to-tray'],
})
export default class SettingsWindowSection extends VueBase {
  @Prop({ required: true })
  public readonly closeToTray: boolean

  public get closeToTrayValue(): boolean {
    return this.closeToTray
  }

  public set closeToTrayValue(value: boolean) {
    this.$emit('update:close-to-tray', value)
  }
}
</script>
