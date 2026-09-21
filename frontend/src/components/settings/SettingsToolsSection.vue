<template>
  <ui-section
      description="Leave a field empty to run the executable found on PATH."
      title="Command-line tools"
  >
    <div class="grid gap-4">
      <settings-text-field
          v-model="kubectlValue"
          hint="Used for kubectl exec, port-forward and node shells."
          label="kubectl"
          placeholder="kubectl (on PATH)"
      />

      <settings-text-field
          v-model="helmValue"
          hint="Used to list releases and read their values."
          label="helm"
          placeholder="helm (on PATH)"
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
  emits: ['update:kubectl-path', 'update:helm-path'],
})
export default class SettingsToolsSection extends VueBase {
  @Prop({ required: true })
  public readonly kubectlPath: string

  @Prop({ required: true })
  public readonly helmPath: string

  public get kubectlValue(): string {
    return this.kubectlPath
  }

  public set kubectlValue(value: string) {
    this.$emit('update:kubectl-path', value)
  }

  public get helmValue(): string {
    return this.helmPath
  }

  public set helmValue(value: string) {
    this.$emit('update:helm-path', value)
  }
}
</script>
