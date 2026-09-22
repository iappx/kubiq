<template>
  <resource-section :hint="hint" :title="title">
    <div v-if="copyCount > 0" class="pb-2">
      <button
          :aria-label="copyAllLabel"
          :title="copyAllLabel"
          class="btn-secondary"
          type="button"
          @click="$emit('copy-group', group.container)"
      >
        <copy :size="14" aria-hidden="true" />
        {{ copyAllText }}
      </button>
    </div>

    <ul v-if="group.entries.length > 0" class="space-y-2">
      <resource-environment-row
          v-for="entry in group.entries"
          :key="entry.id"
          :entry="entry"
          @copy="$emit('copy-entry', $event)"
      />
    </ul>

    <p v-else class="text-xs text-muted-foreground">This container declares no environment variables.</p>
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Copy } from '@lucide/vue'
import ResourceEnvironmentRow from '@/components/resource/detail/ResourceEnvironmentRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { PodEnvironmentText } from '@/application/services/podEnvironment/models/PodEnvironmentText'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'

@Component({
  components: { Copy, ResourceEnvironmentRow, ResourceSection },
  emits: ['copy-entry', 'copy-group'],
})
export default class ResourceEnvironmentGroup extends VueBase {
  @Prop({ required: true })
  public readonly group: TPodEnvironmentGroup

  public get title(): string {
    return this.group.isInit ? `Init container ${this.group.container}` : `Container ${this.group.container}`
  }

  public get hint(): string {
    const count = this.group.entries.length

    return `${count} ${count === 1 ? 'variable' : 'variables'}`
  }

  public get copyCount(): number {
    return PodEnvironmentText.copyable(this.group).length
  }

  public get carriesSecret(): boolean {
    return PodEnvironmentText.hidesSecret(this.group)
  }

  public get copyAllText(): string {
    return this.carriesSecret ? 'Copy all, secrets included' : 'Copy all'
  }

  public get copyAllLabel(): string {
    return this.carriesSecret
      ? `Copy every variable of ${this.group.container} to the clipboard, including secret values`
      : `Copy every variable of ${this.group.container} to the clipboard`
  }
}
</script>
