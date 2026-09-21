<template>
  <ui-section
      description="The image kubiq runs as a privileged pod when you open a shell on a node."
      title="Node shell"
  >
    <settings-text-field
        v-model="imageValue"
        :hint="`Left empty, kubiq uses ${defaultImage}.`"
        :placeholder="defaultImage"
        label="Node shell image"
    />
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import SettingsTextField from '@/components/settings/SettingsTextField.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import { AppSettings } from '@/domain/models/settings'

@Component({
  components: { SettingsTextField, UiSection },
  emits: ['update:node-shell-image'],
})
export default class SettingsNodeShellSection extends VueBase {
  @Prop({ required: true })
  public readonly nodeShellImage: string

  public get defaultImage(): string {
    return AppSettings.DefaultNodeShellImage
  }

  public get imageValue(): string {
    return this.nodeShellImage
  }

  public set imageValue(value: string) {
    this.$emit('update:node-shell-image', value)
  }
}
</script>
