<template>
  <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
    <div class="w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center mb-4">
      <component :is="icon" :size="26" class="text-muted-foreground" />
    </div>
    <h3 class="text-base font-medium text-foreground mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground mb-6 max-w-sm">{{ description }}</p>
    <button v-if="actionLabel && onAction" class="btn-primary" @click="onAction">
      {{ actionLabel }}
    </button>
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class EmptyState extends VueBase {
  @Prop({ required: true })
  public readonly icon: VueComponent

  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: false })
  public readonly description?: string

  @Prop({ required: false })
  public readonly actionLabel?: string

  @Prop({ required: false })
  public readonly onAction?: () => void
}
</script>
