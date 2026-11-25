<template>
  <resource-yaml-discard-dialog
      :open="discardOpen"
      @cancel="$emit('keep-editing')"
      @confirm="$emit('discard-edits')"
  />

  <create-resource-panel
      :cluster-id="clusterId"
      :kind="kind"
      :namespace="createNamespace"
      :open="creating"
      :served="servedKinds"
      :width="uiStore.panelWidth"
      @close="creating = false"
      @created="onCreated"
      @update:width="uiStore.setPanelWidth($event)"
  />

  <delete-resource-dialog
      :busy="acting"
      :kind="kind"
      :open="!!pendingDelete"
      :row="pendingDelete"
      @cancel="pendingDelete = null"
      @confirm="confirmDelete"
  />

  <bulk-delete-dialog
      :busy="acting"
      :kind="kind"
      :open="pendingBulkDelete.length > 0"
      :rows="pendingBulkDelete"
      @cancel="pendingBulkDelete = []"
      @confirm="confirmBulkDelete"
  />

  <scale-workload-dialog
      :busy="acting"
      :current="pendingScaleReplicas"
      :kind="kind"
      :open="!!pendingScale"
      :row="pendingScale"
      @cancel="pendingScale = null"
      @confirm="confirmScale"
  />

  <trigger-cron-job-dialog
      :busy="acting"
      :cluster-id="clusterId"
      :cron-job="pendingTriggerCronJob"
      :job-kind="pendingTriggerJobKind"
      :open="!!pendingTrigger"
      @cancel="pendingTrigger = null"
      @run="confirmTrigger"
  />

  <drain-node-dialog
      :busy="acting"
      :open="!!pendingDrain"
      :row="pendingDrain"
      @cancel="pendingDrain = null"
      @confirm="confirmDrain"
  />

  <default-class-dialog
      :busy="acting"
      :plan="pendingDefault"
      @cancel="pendingDefault = null"
      @confirm="confirmDefault"
  />

  <create-namespace-dialog
      :busy="namespaceStore.creating"
      :open="creatingNamespace"
      @cancel="creatingNamespace = false"
      @confirm="confirmCreateNamespace"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import BulkDeleteDialog from '@/components/resource/BulkDeleteDialog.vue'
import CreateNamespaceDialog from '@/components/resource/CreateNamespaceDialog.vue'
import CreateResourcePanel from '@/components/resource/CreateResourcePanel.vue'
import DefaultClassDialog from '@/components/resource/DefaultClassDialog.vue'
import DeleteResourceDialog from '@/components/resource/DeleteResourceDialog.vue'
import DrainNodeDialog from '@/components/resource/DrainNodeDialog.vue'
import ResourceYamlDiscardDialog from '@/components/resource/detail/ResourceYamlDiscardDialog.vue'
import ScaleWorkloadDialog from '@/components/resource/ScaleWorkloadDialog.vue'
import TriggerCronJobDialog from '@/components/resource/TriggerCronJobDialog.vue'
import { ResourceActions } from '@/components/resource/ResourceActions'
import { ResourceRowBuilder } from '@/components/resource/ResourceRowBuilder'
import { ResourceTargetBuilder } from '@/components/resource/ResourceTargetBuilder'
import { ResourceWorkload } from '@/components/resource/ResourceWorkload'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { TDefaultClassPlan } from '@/application/services/defaultClass/types/TDefaultClassPlan'
import type { CronJobEntity } from '@/domain/entities/workloads'
import { OpenPodLogsEvent } from '@/domain/events/cluster/OpenPodLogsEvent'
import { OpenPodShellEvent } from '@/domain/events/terminal/OpenPodShellEvent'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { KubeKindLocator, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterResourceStore } from '@/store/modules/clusterResource/ClusterResourceStore'
import type { TResourceListState } from '@/store/modules/clusterResource/types/TResourceListState'
import { DefaultClassStore } from '@/store/modules/defaultClass/DefaultClassStore'
import { NamespaceStore } from '@/store/modules/namespace/NamespaceStore'
import { NodeStore } from '@/store/modules/node/NodeStore'

@Component({
  components: {
    BulkDeleteDialog,
    CreateNamespaceDialog,
    CreateResourcePanel,
    DefaultClassDialog,
    DeleteResourceDialog,
    DrainNodeDialog,
    ResourceYamlDiscardDialog,
    ScaleWorkloadDialog,
    TriggerCronJobDialog,
  },
  emits: ['update:acting', 'reload', 'created', 'clear-selection', 'keep-editing', 'discard-edits'],
})
export default class ResourceActionDialogs extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  @Prop({ required: false, default: '' })
  public readonly createNamespace?: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly discardOpen?: boolean

  public pendingDelete: TResourceRow | null = null

  public pendingBulkDelete: TResourceRow[] = []

  public pendingScale: TResourceRow | null = null

  public pendingDrain: TResourceRow | null = null

  public pendingTrigger: TResourceRow | null = null

  public pendingDefault: TDefaultClassPlan | null = null

  public acting = false

  public creating = false

  public creatingNamespace = false

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterResourceStore) private readonly resourceStore: ClusterResourceStore,
      @inject(DefaultClassStore) private readonly defaultClassStore: DefaultClassStore,
      @inject(NamespaceStore) public readonly namespaceStore: NamespaceStore,
      @inject(NodeStore) private readonly nodeStore: NodeStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get state(): TResourceListState {
    return this.resourceStore.stateOf(this.clusterId, this.kind)
  }

  public get servedKinds(): KubeResourceKind[] {
    return this.discoveryStore.kindsOf(this.clusterId)
  }

  public get pendingScaleReplicas(): number {
    return ResourceWorkload.desiredReplicas(this.entityOf(this.pendingScale))
  }

  public get pendingTriggerCronJob(): CronJobEntity | null {
    return ResourceWorkload.asCronJob(this.entityOf(this.pendingTrigger))
  }

  public get pendingTriggerJobKind(): KubeResourceKind | null {
    return this.pendingTrigger ? this.jobKind() : null
  }

  public openCreate(): void {
    this.creating = true
  }

  public closeCreate(): void {
    this.creating = false
  }

  public openCreateNamespace(): void {
    this.creatingNamespace = true
  }

  public askDelete(row: TResourceRow | null): void {
    this.pendingDelete = row
  }

  public askBulkDelete(rows: readonly TResourceRow[]): void {
    if (rows.length > 0) {
      this.pendingBulkDelete = [...rows]
    }
  }

  public askScale(row: TResourceRow | null): void {
    this.pendingScale = row
  }

  public askTrigger(row: TResourceRow | null): void {
    this.pendingTrigger = row
  }

  public askDrain(row: TResourceRow | null): void {
    this.pendingDrain = row
  }

  public reset(): void {
    this.pendingDelete = null
    this.pendingBulkDelete = []
    this.pendingScale = null
    this.pendingDrain = null
    this.pendingTrigger = null
    this.pendingDefault = null
    this.creating = false
    this.creatingNamespace = false
  }

  public handleAction(action: string, row: TResourceRow): void {
    switch (action) {
      case ResourceActions.logsKey:
        this.openLogs(row)
        return
      case ResourceActions.shellKey:
        this.openShell(row)
        return
      case ResourceActions.forwardKey:
        this.openPortForward(row)
        return
      case ResourceActions.scaleKey:
        this.askScale(row)
        return
      case ResourceActions.restartKey:
        void this.restart(row)
        return
      case ResourceActions.triggerKey:
        void this.trigger(row)
        return
      case ResourceActions.triggerEditKey:
        this.askTrigger(row)
        return
      case ResourceActions.suspendKey:
        void this.setSuspended(row, true)
        return
      case ResourceActions.resumeKey:
        void this.setSuspended(row, false)
        return
      case ResourceActions.cordonKey:
        void this.setCordoned(row, true)
        return
      case ResourceActions.uncordonKey:
        void this.setCordoned(row, false)
        return
      case ResourceActions.drainKey:
        this.askDrain(row)
        return
      case ResourceActions.setDefaultKey:
        void this.changeDefault(row, true)
        return
      case ResourceActions.unsetDefaultKey:
        void this.changeDefault(row, false)
        return
      case ResourceActions.deleteKey:
        this.askDelete(row)
    }
  }

  public onCreated(created: { kind: KubeResourceKind; name: string; namespace: string }): void {
    this.creating = false
    this.$emit('created', created)
  }

  public openLogs(row: TResourceRow): void {
    this.eventBus.emitEvent(new OpenPodLogsEvent(this.clusterId, row.namespace, row.name))
  }

  public openShell(row: TResourceRow | null): void {
    if (row) {
      this.eventBus.emitEvent(new OpenPodShellEvent(this.clusterId, row.namespace, row.name))
    }
  }

  public openPortForward(row: TResourceRow | null): void {
    const kind = this.kind
    if (row && kind) {
      this.eventBus.emitEvent(new OpenPortForwardEvent(this.clusterId, row.namespace, kind.resource, row.name))
    }
  }

  public async restart(row: TResourceRow): Promise<void> {
    const target = ResourceTargetBuilder.workloadOf(this.clusterId, this.kind, row)
    if (target) {
      await this.run(() => this.resourceStore.restart(target))
    }
  }

  public async trigger(row: TResourceRow | null, manifest?: Record<string, unknown>): Promise<boolean> {
    const target = ResourceTargetBuilder.workloadOf(this.clusterId, this.kind, row)
    const cronJob = ResourceWorkload.asCronJob(this.entityOf(row))
    const jobKind = this.jobKind()

    if (!target || !cronJob || !jobKind) {
      return false
    }

    return this.run(() => this.resourceStore.trigger(target, {
      clusterId: this.clusterId,
      cronJob,
      jobKind,
      manifest,
    }))
  }

  public async confirmTrigger(manifest: Record<string, unknown>): Promise<void> {
    if (await this.trigger(this.pendingTrigger, manifest)) {
      this.pendingTrigger = null
    }
  }

  public async setSuspended(row: TResourceRow | null, suspended: boolean): Promise<void> {
    const target = ResourceTargetBuilder.workloadOf(this.clusterId, this.kind, row)
    if (!target) {
      return
    }

    const changed = await this.run(() => this.resourceStore.setSuspended(target, suspended))

    if (changed && !this.state.watching) {
      this.$emit('reload')
    }
  }

  public async setCordoned(row: TResourceRow, cordoned: boolean): Promise<void> {
    const target = ResourceTargetBuilder.nodeOf(this.clusterId, this.kind, row)
    if (!target) {
      return
    }

    const changed = await this.run(() => (cordoned
      ? this.nodeStore.cordon(target)
      : this.nodeStore.uncordon(target)))

    if (changed && !this.state.watching) {
      this.$emit('reload')
    }
  }

  public async confirmDelete(): Promise<void> {
    const target = ResourceTargetBuilder.workloadOf(this.clusterId, this.kind, this.pendingDelete)
    if (!target) {
      return
    }

    const removed = await this.run(() => this.resourceStore.remove(target))
    this.pendingDelete = null

    if (!removed) {
      return
    }
    if (this.uiStore.detailName === target.name && this.uiStore.detailNamespace === target.namespace) {
      this.uiStore.closeDetail()
    }
    if (!this.state.watching) {
      this.$emit('reload')
    }
  }

  public async confirmBulkDelete(): Promise<void> {
    const targets = ResourceTargetBuilder.workloadsOf(this.clusterId, this.kind, this.pendingBulkDelete)
    if (targets.length === 0) {
      return
    }

    const outcome = await this.run(() => this.resourceStore.bulkRemove(targets))
    this.pendingBulkDelete = []

    if (outcome.succeeded === 0) {
      return
    }

    this.$emit('clear-selection')
    if (ResourceTargetBuilder.containsObject(targets, this.uiStore.detailNamespace, this.uiStore.detailName)) {
      this.uiStore.closeDetail()
    }
    if (!this.state.watching) {
      this.$emit('reload')
    }
  }

  public async bulkRestart(rows: readonly TResourceRow[]): Promise<void> {
    const targets = ResourceTargetBuilder.workloadsOf(this.clusterId, this.kind, rows)
    if (targets.length === 0) {
      return
    }

    const outcome = await this.run(() => this.resourceStore.bulkRestart(targets))
    if (outcome.succeeded > 0) {
      this.$emit('clear-selection')
    }
  }

  public async bulkCordon(rows: readonly TResourceRow[]): Promise<void> {
    await this.runBulkScheduling(rows, true)
  }

  public async bulkUncordon(rows: readonly TResourceRow[]): Promise<void> {
    await this.runBulkScheduling(rows, false)
  }

  public async confirmScale(replicas: number): Promise<void> {
    const target = ResourceTargetBuilder.workloadOf(this.clusterId, this.kind, this.pendingScale)
    if (!target) {
      return
    }

    await this.run(() => this.resourceStore.scale(target, replicas))
    this.pendingScale = null
  }

  public async confirmDrain(): Promise<void> {
    const target = ResourceTargetBuilder.nodeOf(this.clusterId, this.kind, this.pendingDrain)
    const podsKind = this.podsKind()
    if (!target || !podsKind) {
      return
    }

    await this.run(() => this.nodeStore.drain({ target, podsKind }))
    this.pendingDrain = null

    if (!this.state.watching) {
      this.$emit('reload')
    }
  }

  public async changeDefault(row: TResourceRow | null, isDefault: boolean): Promise<void> {
    const kind = this.kind
    if (!row || !kind) {
      return
    }

    const plan = await this.defaultClassStore.prepare(
      { clusterId: this.clusterId, kind, name: row.name, rowKey: row.key },
      isDefault,
    )
    if (!plan) {
      return
    }

    this.pendingDefault = plan
  }

  public async confirmDefault(): Promise<void> {
    const plan = this.pendingDefault
    if (!plan) {
      return
    }

    const applied = await this.run(() => this.defaultClassStore.apply(plan))
    this.pendingDefault = null

    if (applied && !this.state.watching) {
      this.$emit('reload')
    }
  }

  public async confirmCreateNamespace(name: string): Promise<void> {
    const kind = this.kind
    if (!kind) {
      return
    }

    const created = await this.namespaceStore.create({ clusterId: this.clusterId, kind, name })
    if (!created) {
      return
    }

    this.creatingNamespace = false
    if (!this.state.watching) {
      this.$emit('reload')
    }
  }

  private async runBulkScheduling(rows: readonly TResourceRow[], cordoned: boolean): Promise<void> {
    const targets = ResourceTargetBuilder.nodesOf(this.clusterId, this.kind, rows)
    if (targets.length === 0) {
      return
    }

    const outcome = await this.run(() => (cordoned
      ? this.nodeStore.bulkCordon(targets)
      : this.nodeStore.bulkUncordon(targets)))

    if (outcome.succeeded > 0) {
      this.$emit('clear-selection')
      if (!this.state.watching) {
        this.$emit('reload')
      }
    }
  }

  private jobKind(): KubeResourceKind | null {
    const slug = KubeResourceRegistry.find('batch', 'jobs')?.slug ?? ''

    return this.discoveryStore.findBySlug(this.clusterId, slug)
        ?? KubeResourceRegistry.find('batch', 'jobs')
        ?? null
  }

  private podsKind(): KubeResourceKind | null {
    return KubeKindLocator.find(this.servedKinds, 'v1', 'Pod')
        ?? KubeResourceRegistry.find('', 'pods')
        ?? null
  }

  private entityOf(row: TResourceRow | null): RepoEntityBase | null {
    if (!row) {
      return null
    }

    return this.state.items.find(item => ResourceRowBuilder.keyOf(item) === row.key) ?? null
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    this.setActing(true)
    try {
      return await action()
    } finally {
      this.setActing(false)
    }
  }

  private setActing(value: boolean): void {
    this.acting = value
    this.$emit('update:acting', value)
  }
}
</script>
