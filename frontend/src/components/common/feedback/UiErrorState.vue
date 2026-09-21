<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center" role="alert">
    <div class="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
      <circle-alert :size="24" aria-hidden="true" class="text-destructive" />
    </div>

    <div class="space-y-1">
      <h3 class="text-sm font-medium text-foreground">{{ title }}</h3>
      <p class="text-sm text-muted-foreground max-w-md">{{ message }}</p>
      <p v-if="hint" class="text-xs text-muted-foreground max-w-md font-mono">{{ hint }}</p>
    </div>

    <button v-if="retryable" class="btn-secondary" type="button" @click="$emit('retry')">
      <refresh-cw :size="14" aria-hidden="true" />
      {{ retryLabel }}
    </button>

    <details v-if="detail" class="w-full max-w-md text-left">
      <summary class="text-xs text-muted-foreground cursor-default select-none">Technical detail</summary>
      <pre class="mt-2 p-3 rounded-md bg-muted text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">{{ detail }}</pre>
    </details>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { CircleAlert, RefreshCw } from '@lucide/vue'

@Component({
  components: { CircleAlert, RefreshCw },
  emits: ['retry'],
})
export default class UiErrorState extends VueBase {
  @Prop({ required: true })
  public readonly message: string

  @Prop({ required: false, default: 'Could not load this list' })
  public readonly title?: string

  @Prop({ required: false })
  public readonly hint?: string

  @Prop({ required: false })
  public readonly detail?: string

  @Prop({ required: false, default: true })
  public readonly retryable?: boolean

  @Prop({ required: false, default: 'Retry' })
  public readonly retryLabel?: string
}
</script>
