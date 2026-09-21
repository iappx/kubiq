<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <p class="shrink-0 text-xs text-muted-foreground">
      Everything this revision applied to the cluster, exactly as helm rendered it.
    </p>

    <p v-if="isEmpty" class="text-xs text-muted-foreground">This release rendered no objects.</p>

    <monaco-editor
        v-else
        :label="`Manifest of ${detail.name}`"
        :path="modelPath"
        :value="detail.manifest"
        class="min-h-64"
        readonly
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import type { THelmReleaseDetail } from '@/store/modules/helm/types/THelmReleaseDetail'

@Component({
  components: { MonacoEditor },
})
export default class HelmReleaseManifestTab extends VueBase {
  @Prop({ required: true })
  public readonly detail: THelmReleaseDetail

  public get isEmpty(): boolean {
    return this.detail.manifest.trim() === ''
  }

  public get modelPath(): string {
    return `inmemory://kubiq/helm/${encodeURIComponent(this.detail.namespace)}/${encodeURIComponent(this.detail.name)}/manifest.yaml`
  }
}
</script>
