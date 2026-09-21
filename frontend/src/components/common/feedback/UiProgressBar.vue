<template>
  <div
      :aria-label="label"
      :aria-valuemax="indeterminate ? undefined : 100"
      :aria-valuemin="indeterminate ? undefined : 0"
      :aria-valuenow="indeterminate ? undefined : value"
      class="ui-progress"
      role="progressbar"
  >
    <div v-if="indeterminate" class="ui-progress-bar" />
    <div v-else :style="{ width: `${value}%` }" class="ui-progress-value" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class UiProgressBar extends VueBase {
  @Prop({ required: false, default: true })
  public readonly indeterminate?: boolean

  @Prop({ required: false, default: 0 })
  public readonly value?: number

  @Prop({ required: false, default: 'Loading' })
  public readonly label?: string
}
</script>
