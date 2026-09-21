<template>
  <li class="flex items-start gap-3 py-2">
    <span class="tabular text-xs text-muted-foreground w-8 shrink-0">#{{ revision.revision }}</span>

    <div class="min-w-0 flex-1 space-y-0.5">
      <div class="flex items-center gap-2">
        <ui-status-badge :label="statusText" :tone="tone" />
        <span v-if="isCurrent" class="pill pill-active">Current</span>
      </div>
      <p class="truncate text-xs text-foreground" :title="revision.description">{{ revision.description || '—' }}</p>
      <p class="text-xs text-muted-foreground">
        {{ revision.chart }}<template v-if="revision.appVersion"> · app {{ revision.appVersion }}</template> ·
        <ui-age :value="revision.updated" />
      </p>
    </div>

    <button
        v-if="!isCurrent"
        :aria-label="`Roll back to revision ${revision.revision}`"
        :disabled="busy"
        class="btn-secondary shrink-0 disabled:opacity-50"
        :title="`Roll back to revision ${revision.revision}`"
        type="button"
        @click="$emit('rollback', revision.revision)"
    >
      <undo2 :size="14" />
      Roll back
    </button>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Undo2 } from '@lucide/vue'
import UiAge from '@/components/common/time/UiAge.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { HelmToneMap } from '@/components/helm/HelmToneMap'
import { HelmReleaseStatusCatalog } from '@/domain/entities/helm/HelmReleaseStatusCatalog'
import type { HelmRevisionEntity } from '@/domain/entities/helm/HelmRevisionEntity'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { UiAge, UiStatusBadge, Undo2 },
  emits: ['rollback'],
})
export default class HelmRevisionRow extends VueBase {
  @Prop({ required: true })
  public readonly revision: HelmRevisionEntity

  @Prop({ required: false, default: false })
  public readonly isCurrent?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get statusText(): string {
    return HelmReleaseStatusCatalog.title(this.revision.status)
  }

  public get tone(): TUiTone {
    return HelmToneMap.ofRelease(this.revision.status)
  }
}
</script>
