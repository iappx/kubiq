<template>
  <div class="ui-conflict" role="alert">
    <div class="flex items-start gap-2">
      <triangle-alert :size="14" class="mt-0.5 shrink-0 text-warning" />
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-medium text-foreground">The object changed in the cluster while you were editing</p>
        <p class="text-xs text-muted-foreground">
          Something else wrote to it, so the version you started from is no longer the current one.
          The difference below is the cluster's copy on the left and yours on the right.
        </p>
      </div>
    </div>

    <resource-diff-view :label="diffLabel" :lines="lines" class="max-h-64 overflow-auto" />

    <div class="flex flex-wrap items-center gap-2">
      <button class="btn-secondary h-7 px-3 text-xs" type="button" @click="$emit('reload')">
        Reload from cluster
      </button>
      <button class="btn-primary h-7 px-3 text-xs" type="button" @click="$emit('reapply')">
        Reapply on top
      </button>
      <button class="btn-ghost h-7 px-3 text-xs" type="button" @click="$emit('dismiss')">
        Keep editing
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { TriangleAlert } from '@lucide/vue'
import ResourceDiffView from '@/components/resource/detail/ResourceDiffView.vue'
import { YamlDiff } from '@/application/services/resourceYaml/models/YamlDiff'
import type { TYamlDiffLine } from '@/application/services/resourceYaml/types/TYamlDiffLine'

@Component({
  components: { ResourceDiffView, TriangleAlert },
  emits: ['reload', 'reapply', 'dismiss'],
})
export default class ResourceYamlConflict extends VueBase {
  public static readonly diffLabel: string = 'What the cluster holds against your draft'

  @Prop({ required: true })
  public readonly clusterText: string

  @Prop({ required: true })
  public readonly draftText: string

  public get lines(): TYamlDiffLine[] {
    return YamlDiff.condense(YamlDiff.of(this.clusterText, this.draftText))
  }

  public get diffLabel(): string {
    return ResourceYamlConflict.diffLabel
  }
}
</script>
