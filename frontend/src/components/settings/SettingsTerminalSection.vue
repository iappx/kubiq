<template>
  <ui-section
      description="Applies to the local shell and terminal tabs."
      title="Terminal"
  >
    <div class="grid gap-4">
      <settings-text-field
          v-model="shellValue"
          hint="Executable path or name for local shell tabs. Leave empty to use your default shell."
          label="Local shell"
          placeholder="System default (SHELL or PowerShell)"
      />

      <settings-text-field
          v-model="fontFamilyValue"
          hint="Optional monospace or Nerd Font name for Powerline and prompt icons, e.g. JetBrainsMono Nerd Font."
          label="Font family"
          placeholder="App monospace font"
      />
    </div>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import SettingsTextField from '@/components/settings/SettingsTextField.vue'
import UiSection from '@/components/common/section/UiSection.vue'

@Component({
  components: { SettingsTextField, UiSection },
  emits: ['update:terminal-shell', 'update:terminal-font-family'],
})
export default class SettingsTerminalSection extends VueBase {
  @Prop({ required: true })
  public readonly terminalShell: string

  @Prop({ required: true })
  public readonly terminalFontFamily: string

  public get shellValue(): string {
    return this.terminalShell
  }

  public set shellValue(value: string) {
    this.$emit('update:terminal-shell', value)
  }

  public get fontFamilyValue(): string {
    return this.terminalFontFamily
  }

  public set fontFamilyValue(value: string) {
    this.$emit('update:terminal-font-family', value)
  }
}
</script>
