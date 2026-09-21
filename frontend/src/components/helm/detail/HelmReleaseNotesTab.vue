<template>
  <div class="min-h-0 space-y-2">
    <p v-if="isEmpty" class="text-xs text-muted-foreground">This chart ships no notes.</p>

    <pre
        v-else
        class="whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 text-xs text-foreground"
    >{{ detail.notes }}</pre>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import type { THelmReleaseDetail } from '@/store/modules/helm/types/THelmReleaseDetail'

@Component({})
export default class HelmReleaseNotesTab extends VueBase {
  @Prop({ required: true })
  public readonly detail: THelmReleaseDetail

  public get isEmpty(): boolean {
    return this.detail.notes.trim() === ''
  }
}
</script>
