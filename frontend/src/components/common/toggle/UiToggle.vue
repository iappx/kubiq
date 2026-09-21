<template>
  <button
      :class="[
        'flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-md border text-left transition-colors',
        checked ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted',
      ]"
      type="button"
      @click="toggle"
  >
    <div class="min-w-0">
      <div class="text-sm font-medium text-foreground">{{ label }}</div>
      <div v-if="description" class="text-xs text-muted-foreground mt-0.5">{{ description }}</div>
    </div>
    <span
        :class="[
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        ]"
    >
      <span
          :class="[
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          ]"
      />
    </span>
  </button>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class UiToggle extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false })
  public readonly description?: string

  @VModel()
  public checked: boolean

  toggle(): void {
    this.checked = !this.checked
  }
}
</script>
