<template>
  <component
      :is="icon"
      :aria-hidden="label ? undefined : 'true'"
      :aria-label="label"
      :role="label ? 'img' : undefined"
      :size="size"
      class="shrink-0"
  />
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { KubeIconResolver } from '@/components/common/icon/KubeIconResolver'

@Component({})
export default class KubeIcon extends VueBase {
  @Prop({ required: true })
  public readonly name: string

  @Prop({ required: false, default: 14 })
  public readonly size?: number

  @Prop({ required: false })
  public readonly label?: string

  public get icon(): VueComponent {
    return KubeIconResolver.resolve(this.name)
  }
}
</script>
