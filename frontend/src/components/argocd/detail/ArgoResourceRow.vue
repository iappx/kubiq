<template>
  <li class="flex items-center gap-2 py-1">
    <ui-status-dot :size="8" :tone="row.tone" class="shrink-0" />

    <router-link
        v-if="path"
        :title="row.name"
        :to="path"
        class="ui-name-button truncate"
    >{{ row.name }}</router-link>
    <span v-else :title="row.name" class="truncate text-foreground">{{ row.name }}</span>

    <span v-if="row.requiresPruning" class="pill shrink-0">Prunes</span>

    <span :title="statusTitle" class="ml-auto shrink-0 text-xs text-muted-foreground">{{ statusText }}</span>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TArgoResourceRow } from '@/components/argocd/types/TArgoResourceRow'

@Component({
  components: { UiStatusDot },
})
export default class ArgoResourceRow extends VueBase {
  @Prop({ required: true })
  public readonly row: TArgoResourceRow

  @Prop({ required: false, default: '' })
  public readonly path?: string

  public get statusText(): string {
    return [this.row.syncText, this.row.healthText].filter(part => part !== '').join(' · ')
  }

  public get statusTitle(): string {
    return this.row.healthMessage || this.statusText
  }
}
</script>
