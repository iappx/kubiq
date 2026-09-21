<template>
  <div class="min-h-0 space-y-3">
    <p v-if="links.length === 0" class="text-xs text-muted-foreground">This release rendered no objects.</p>

    <ui-section
        v-for="group in groups"
        :key="group.title"
        :description="group.description"
        :title="group.title"
    >
      <ul class="divide-y divide-border">
        <helm-resource-row
            v-for="link in group.links"
            :key="link.key"
            :icon="group.icon"
            :link="link"
        />
      </ul>
    </ui-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiSection from '@/components/common/section/UiSection.vue'
import HelmResourceRow from '@/components/helm/detail/HelmResourceRow.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import type { THelmManifestResource } from '@/application/services/helm/types/THelmManifestResource'
import type { THelmResourceGroup } from '@/components/helm/types/THelmResourceGroup'
import type { THelmResourceLink } from '@/components/helm/types/THelmResourceLink'
import { KubeKindLocator } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'

@Component({
  components: { HelmResourceRow, UiSection },
})
export default class HelmReleaseResourcesTab extends VueBase {
  public static readonly unknownGroup: string = 'Not served by this cluster'

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly resources: THelmManifestResource[]

  constructor(
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
  ) {
    super()
  }

  public get links(): THelmResourceLink[] {
    return this.resources.map((resource, index) => this.link(resource, index))
  }

  public get groups(): THelmResourceGroup[] {
    const byTitle = new Map<string, THelmResourceGroup>()

    this.links.forEach((link) => {
      const kind = this.kindOf(link.resource)
      const title = kind ? kind.title : link.resource.kind
      const group = byTitle.get(title) ?? {
        title,
        description: kind ? '' : HelmReleaseResourcesTab.unknownGroup,
        icon: kind?.icon ?? '',
        links: [],
      }
      group.links.push(link)
      byTitle.set(title, group)
    })

    return [...byTitle.values()].sort((left, right) => left.title.localeCompare(right.title))
  }

  private link(resource: THelmManifestResource, index: number): THelmResourceLink {
    const kind = this.kindOf(resource)

    return {
      key: `${resource.kind}/${resource.namespace}/${resource.name}/${index}`,
      resource,
      title: resource.namespace === '' ? resource.kind : `${resource.namespace} · ${resource.kind}`,
      path: kind ? ClusterRoutes.forKind(this.clusterId, kind) : '',
    }
  }

  private kindOf(resource: THelmManifestResource): KubeResourceKind | undefined {
    return KubeKindLocator.find(
        this.discoveryStore.kindsOf(this.clusterId),
        resource.apiVersion,
        resource.kind,
    )
  }
}
</script>
