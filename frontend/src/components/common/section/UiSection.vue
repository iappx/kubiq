<template>
  <section class="surface p-5 space-y-4">
    <header v-if="title || $slots.actions" class="flex items-center justify-between gap-3">
      <div>
        <h3 v-if="title" class="text-sm font-semibold text-foreground">{{ title }}</h3>
        <p v-if="description" class="text-xs text-muted-foreground mt-0.5">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class UiSection extends VueBase {
  @Prop({ required: false })
  public readonly title?: string

  @Prop({ required: false })
  public readonly description?: string
}
</script>
