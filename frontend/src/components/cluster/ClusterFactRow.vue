<template>
  <div class="flex items-baseline gap-3 text-xs">
    <dt class="w-28 shrink-0 text-muted-foreground">{{ label }}</dt>
    <dd :title="value" class="min-w-0 flex-1 truncate text-foreground">
      <slot>{{ value || '—' }}</slot>
    </dd>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class ClusterFactRow extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: '' })
  public readonly value?: string
}
</script>
