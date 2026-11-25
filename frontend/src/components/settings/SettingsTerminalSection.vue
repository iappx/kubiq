<template>
  <ui-section
      description="Applies to the local shell and terminal tabs."
      title="Terminal"
  >
    <div class="grid gap-4">
      <fieldset class="space-y-1.5">
        <legend class="text-sm text-muted-foreground">Terminal mode</legend>

        <div class="grid gap-1">
          <label
              v-for="mode in modes"
              :key="mode"
              class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <input
                v-model="modeValue"
                :name="groupName"
                :value="mode"
                class="mt-0.5 shrink-0 accent-primary"
                type="radio"
            >
            <span class="flex min-w-0 flex-col">
              <span class="text-sm text-foreground">{{ titleOf(mode) }}</span>
              <span class="text-xs text-muted-foreground">{{ descriptionOf(mode) }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <settings-text-field
          v-if="terminalMode === 'custom'"
          v-model="externalCommandValue"
          hint="Application name or executable path to launch when opening a cluster terminal."
          label="Custom terminal"
          placeholder="iTerm, Ghostty, wt.exe or /usr/bin/alacritty"
      />

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
import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import SettingsTextField from '@/components/settings/SettingsTextField.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import { TerminalModeCatalog } from '@/domain/models/settings/TerminalModeCatalog'
import type { TTerminalMode } from '@/domain/models/settings/types/TTerminalMode'

@Component({
  components: { SettingsTextField, UiSection },
  emits: [
    'update:terminal-mode',
    'update:external-terminal-command',
    'update:terminal-shell',
    'update:terminal-font-family',
  ],
})
export default class SettingsTerminalSection extends VueBase {
  @Prop({ required: true })
  public readonly terminalMode: TTerminalMode

  @Prop({ required: true })
  public readonly externalTerminalCommand: string

  @Prop({ required: true })
  public readonly terminalShell: string

  @Prop({ required: true })
  public readonly terminalFontFamily: string

  public groupName = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.groupName = `terminal-mode-${this.idService.next()}`
  }

  public get modes(): TTerminalMode[] {
    return TerminalModeCatalog.modes
  }

  public get modeValue(): TTerminalMode {
    return this.terminalMode
  }

  public set modeValue(value: TTerminalMode) {
    this.$emit('update:terminal-mode', value)
  }

  public get externalCommandValue(): string {
    return this.externalTerminalCommand
  }

  public set externalCommandValue(value: string) {
    this.$emit('update:external-terminal-command', value)
  }

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

  public titleOf(mode: TTerminalMode): string {
    return TerminalModeCatalog.title(mode)
  }

  public descriptionOf(mode: TTerminalMode): string {
    return TerminalModeCatalog.description(mode)
  }
}
</script>
