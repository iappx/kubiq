<template>
  <section class="space-y-2">
    <header class="flex items-baseline justify-between gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ title }}</h3>
      <span v-if="hint" class="text-xs text-muted-foreground truncate">{{ hint }}</span>
    </header>

    <slot />
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class ResourceSection extends VueBase {
  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: false, default: '' })
  public readonly hint?: string
}
</script>
