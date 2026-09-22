<template>
  <li class="flex items-start gap-3 py-2">
    <span class="tabular text-xs text-muted-foreground w-8 shrink-0">#{{ row.id }}</span>

    <div class="min-w-0 flex-1 space-y-0.5">
      <div class="flex items-center gap-2">
        <span :title="row.revision" class="truncate text-xs text-foreground tabular">{{ row.shortRevision || '—' }}</span>
        <span v-if="row.isCurrent" class="pill pill-active">Current</span>
      </div>
      <p class="text-xs text-muted-foreground truncate" :title="row.source">
        {{ row.source || '—' }} · <ui-age :value="row.deployedAt" />
      </p>
    </div>

    <button
        v-if="!row.isCurrent && canSync"
        :aria-label="`Roll back to revision ${row.shortRevision}`"
        :disabled="busy"
        :title="`Roll back to revision ${row.shortRevision}`"
        class="btn-secondary shrink-0 disabled:opacity-50"
        type="button"
        @click="$emit('rollback', row.revision)"
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
import type { TArgoHistoryRow } from '@/components/argocd/types/TArgoHistoryRow'

@Component({
  components: { UiAge, Undo2 },
  emits: ['rollback'],
})
export default class ArgoHistoryRow extends VueBase {
  @Prop({ required: true })
  public readonly row: TArgoHistoryRow

  @Prop({ required: false, default: false })
  public readonly canSync?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean
}
</script>
