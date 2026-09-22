<template>
  <ui-section
      description="Every revision Argo CD has deployed, newest first"
      title="Deployment history"
  >
    <p v-if="rows.length === 0" class="text-xs text-muted-foreground">
      Argo CD has recorded no deployment for this application yet.
    </p>

    <ul v-else class="divide-y divide-border">
      <argo-history-row
          v-for="row in rows"
          :key="row.key"
          :busy="busy"
          :can-sync="canSync"
          :row="row"
          @rollback="$emit('rollback', $event)"
      />
    </ul>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import ArgoHistoryRow from '@/components/argocd/detail/ArgoHistoryRow.vue'
import { ArgoHistoryRowBuilder } from '@/components/argocd/detail/ArgoHistoryRowBuilder'
import type { TArgoHistoryRow } from '@/components/argocd/types/TArgoHistoryRow'
import type { TArgoRevisionHistory } from '@/domain/entities/argocd/types/TArgoRevisionHistory'

@Component({
  components: { ArgoHistoryRow, UiSection },
  emits: ['rollback'],
})
export default class ArgoApplicationHistoryTab extends VueBase {
  @Prop({ required: true })
  public readonly history: TArgoRevisionHistory[]

  @Prop({ required: false, default: '' })
  public readonly currentRevision?: string

  @Prop({ required: false, default: false })
  public readonly canSync?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get rows(): TArgoHistoryRow[] {
    return ArgoHistoryRowBuilder.build(this.history, this.currentRevision ?? '')
  }
}
</script>
