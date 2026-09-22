<template>
  <div class="space-y-3">
    <ui-section title="Application">
      <argo-fact-list :facts="facts" />
    </ui-section>

    <ui-section
        description="Argo CD keeps the cluster at the revision the repository declares"
        title="Sync policy"
    >
      <div class="space-y-2">
        <ui-toggle
            :model-value="application.isAutoSync"
            description="Argo CD syncs on its own as soon as the repository moves"
            label="Automated"
            @update:model-value="setAutomated($event)"
        />

        <ui-toggle
            v-if="application.isAutoSync"
            :model-value="application.isAutoPruning"
            description="Objects the repository no longer declares are deleted"
            label="Prune"
            @update:model-value="setPrune($event)"
        />

        <ui-toggle
            v-if="application.isAutoSync"
            :model-value="application.isSelfHealing"
            description="A change made straight in the cluster is reverted"
            label="Self-heal"
            @update:model-value="setSelfHeal($event)"
        />
      </div>
    </ui-section>

    <ui-section v-if="hasOperation" title="Last operation">
      <div class="space-y-2">
        <ui-status-badge :label="operationText" :tone="operationTone" />
        <argo-fact-list :facts="operationFacts" />
        <p v-if="application.operationMessage" class="text-xs text-muted-foreground break-words">
          {{ application.operationMessage }}
        </p>
      </div>
    </ui-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'
import ArgoFactList from '@/components/argocd/detail/ArgoFactList.vue'
import { ArgoToneMap } from '@/components/argocd/ArgoToneMap'
import type { TArgoFact } from '@/components/argocd/types/TArgoFact'
import type { ArgoApplicationEntity } from '@/domain/entities/argocd/ArgoApplicationEntity'
import { ArgoOperationPhaseCatalog } from '@/domain/entities/argocd/ArgoOperationPhaseCatalog'
import type { TArgoAutomatedSyncPolicy } from '@/domain/entities/argocd/types/TArgoAutomatedSyncPolicy'
import { ArgoRevision } from '@/domain/models/argocd'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { ArgoFactList, UiSection, UiStatusBadge, UiToggle },
  emits: ['automated'],
})
export default class ArgoApplicationOverviewTab extends VueBase {
  @Prop({ required: true })
  public readonly application: ArgoApplicationEntity

  public get facts(): TArgoFact[] {
    const source = this.application.source

    return [
      { label: 'Project', value: this.application.project },
      { label: 'Destination', value: this.application.destinationCluster },
      { label: 'Namespace', value: this.application.destinationNamespace },
      { label: 'Repository', value: this.application.repoUrl },
      { label: source.chart ? 'Chart' : 'Path', value: this.application.sourceText },
      { label: 'Target revision', value: this.application.targetRevision },
      { label: 'Synced revision', value: ArgoRevision.short(this.application.syncedRevision) },
      { label: 'Lives in', value: this.application.namespace },
      { label: 'Reconciled', value: this.application.status?.reconciledAt ?? '', isAge: true },
      { label: 'Created', value: this.application.createdAt, isAge: true },
    ]
  }

  public get hasOperation(): boolean {
    return this.application.operationPhase !== undefined
  }

  public get operationText(): string {
    const phase = this.application.operationPhase

    return phase ? ArgoOperationPhaseCatalog.title(phase) : ''
  }

  public get operationTone(): TUiTone {
    return ArgoToneMap.ofPhase(this.application.operationPhase)
  }

  public get operationFacts(): TArgoFact[] {
    const state = this.application.status?.operationState

    return [
      { label: 'Started', value: state?.startedAt ?? '', isAge: true },
      { label: 'Finished', value: state?.finishedAt ?? '', isAge: true },
      { label: 'Retries', value: String(state?.retryCount ?? 0) },
    ]
  }

  public setAutomated(enabled: boolean): void {
    this.$emit('automated', enabled ? { prune: false, selfHeal: false } : null)
  }

  public setPrune(prune: boolean): void {
    this.$emit('automated', this.withChange({ prune }))
  }

  public setSelfHeal(selfHeal: boolean): void {
    this.$emit('automated', this.withChange({ selfHeal }))
  }

  private withChange(change: Partial<TArgoAutomatedSyncPolicy>): TArgoAutomatedSyncPolicy {
    return {
      prune: this.application.isAutoPruning,
      selfHeal: this.application.isSelfHealing,
      ...change,
    }
  }
}
</script>
