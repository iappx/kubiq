<template>
  <div class="min-h-0 space-y-3">
    <p v-if="rows.length === 0" class="text-xs text-muted-foreground">
      Argo CD has not reported any object for this application yet.
    </p>

    <ui-section v-for="group in groups" :key="group.title" :description="group.description" :title="group.title">
      <ul class="divide-y divide-border">
        <argo-resource-row
            v-for="row in group.rows"
            :key="row.key"
            :path="pathOf(row)"
            :row="row"
        />
      </ul>
    </ui-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiSection from '@/components/common/section/UiSection.vue'
import ArgoResourceRow from '@/components/argocd/detail/ArgoResourceRow.vue'
import { ArgoResourceRowBuilder } from '@/components/argocd/detail/ArgoResourceRowBuilder'
import type { TArgoResourceGroup } from '@/components/argocd/types/TArgoResourceGroup'
import type { TArgoResourceRow } from '@/components/argocd/types/TArgoResourceRow'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import type { TArgoResourceStatus } from '@/domain/entities/argocd/types/TArgoResourceStatus'
import { KubeKindLocator } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'

@Component({
  components: { ArgoResourceRow, UiSection },
})
export default class ArgoApplicationResourcesTab extends VueBase {
  public static readonly unknownGroup: string = 'Not served by this cluster'

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly resources: TArgoResourceStatus[]

  constructor(
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
  ) {
    super()
  }

  public get rows(): TArgoResourceRow[] {
    return ArgoResourceRowBuilder.build(this.resources)
  }

  public get groups(): TArgoResourceGroup[] {
    const byTitle = new Map<string, TArgoResourceGroup>()

    this.rows.forEach((row) => {
      const kind = this.kindOf(row)
      const title = kind ? kind.title : row.kind
      const group = byTitle.get(title) ?? {
        title,
        description: kind ? '' : ArgoApplicationResourcesTab.unknownGroup,
        rows: [],
      }
      group.rows.push(row)
      byTitle.set(title, group)
    })

    return [...byTitle.values()].sort((left, right) => left.title.localeCompare(right.title))
  }

  public pathOf(row: TArgoResourceRow): string {
    const kind = this.kindOf(row)

    return kind
        ? ClusterRoutes.object(this.clusterId, kind, { namespace: row.namespace, name: row.name })
        : ''
  }

  private kindOf(row: TArgoResourceRow): KubeResourceKind | undefined {
    return KubeKindLocator.find(this.discoveryStore.kindsOf(this.clusterId), row.apiVersion, row.kind)
  }
}
</script>
