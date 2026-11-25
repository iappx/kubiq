<template>
  <div class="space-y-4">
    <metadata-ownership-bar
        v-if="ownershipBadges.length > 0"
        :badges="ownershipBadges"
        @open-ref="openReference"
    />

    <resource-section :hint="countOf(labelEntries)" title="Labels">
      <metadata-section-list
          :can-filter="canFilterLabels"
          :entries="labelEntries"
          empty-label="This object carries no labels"
          kind="label"
          @copy="copyText"
          @filter-label="$emit('filter-label', $event)"
          @open-ref="openReference"
          @open-url="openUrl"
      />
    </resource-section>

    <resource-section :hint="countOf(annotationEntries)" title="Annotations">
      <metadata-section-list
          :can-diff-last-applied="true"
          :entries="annotationEntries"
          empty-label="This object carries no annotations"
          kind="annotation"
          @copy="copyText"
          @open-diff="openDiff"
          @open-ref="openReference"
          @open-url="openUrl"
      />
    </resource-section>

    <resource-section v-if="finalizers.length > 0" :hint="countOf(finalizers)" title="Finalizers">
      <ul class="space-y-1">
        <li v-for="finalizer in finalizers" :key="finalizer" class="break-all font-mono text-xs text-muted-foreground">
          {{ finalizer }}
        </li>
      </ul>
    </resource-section>

    <metadata-last-applied-dialog
        :current-object="object"
        :last-applied="diffLastApplied"
        :open="diffOpen"
        @close="closeDiff"
        @copy="copyText"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ExternalLinkService } from '@/application/services/externalLink/ExternalLinkService'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { DetailFacts } from '@/components/resource/detail/DetailFacts'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import MetadataLastAppliedDialog from '@/components/resource/detail/metadata/MetadataLastAppliedDialog.vue'
import MetadataOwnershipBar from '@/components/resource/detail/metadata/MetadataOwnershipBar.vue'
import MetadataSectionList from '@/components/resource/detail/metadata/MetadataSectionList.vue'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
import { KubeKindLocator, KubeManifest, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { MetadataOwnershipExtractor, MetadataParser } from '@/domain/models/metadata'
import type { TMetadataEntry, TMetadataOwnershipBadge, TMetadataReferenceTarget } from '@/domain/models/metadata'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'

@Component({
  components: {
    MetadataLastAppliedDialog,
    MetadataOwnershipBar,
    MetadataSectionList,
    ResourceSection,
  },
  emits: ['open', 'filter-label'],
})
export default class ResourceMetadataTab extends VueBase {
  @Prop({ required: true })
  public readonly object: Record<string, unknown>

  @Prop({ required: false, default: null })
  public readonly target?: TResourceObjectRef | null

  @Prop({ required: false, default: false })
  public readonly canFilterLabels?: boolean

  public diffOpen = false

  public diffLastApplied: unknown = null

  constructor(
      @inject(ClipboardService) private readonly clipboard: ClipboardService,
      @inject(ExternalLinkService) private readonly externalLink: ExternalLinkService,
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get labels(): Record<string, string> {
    return DetailFacts.labelsOf(this.object)
  }

  public get annotations(): Record<string, string> {
    return DetailFacts.annotationsOf(this.object)
  }

  public get namespace(): string {
    return this.target?.namespace || KubeManifest.namespaceOf(this.object)
  }

  public get objectKind(): string {
    return KubeManifest.kindOf(this.object) || (this.target?.kind.kind ?? '')
  }

  public get labelEntries(): TMetadataEntry[] {
    return MetadataParser.parseMap(this.labels, {
      kind: 'label',
      namespace: this.namespace,
      objectKind: this.objectKind,
      allLabels: this.labels,
      allAnnotations: this.annotations,
    })
  }

  public get annotationEntries(): TMetadataEntry[] {
    return MetadataParser.parseMap(this.annotations, {
      kind: 'annotation',
      namespace: this.namespace,
      objectKind: this.objectKind,
      allLabels: this.labels,
      allAnnotations: this.annotations,
    })
  }

  public get ownershipBadges(): TMetadataOwnershipBadge[] {
    return MetadataOwnershipExtractor.extract(this.labels, this.annotations, this.namespace)
  }

  public get finalizers(): string[] {
    const finalizers = KubeManifest.metadataOf(this.object).finalizers

    return Array.isArray(finalizers) ? finalizers.filter((item): item is string => typeof item === 'string') : []
  }

  public countOf(items: readonly unknown[]): string {
    return items.length === 0 ? '' : String(items.length)
  }

  public openDiff(lastApplied: unknown): void {
    this.diffLastApplied = lastApplied
    this.diffOpen = true
  }

  public closeDiff(): void {
    this.diffOpen = false
    this.diffLastApplied = null
  }

  public async copyText(payload: { text: string; label: string }): Promise<void> {
    try {
      await this.clipboard.write(payload.text)
      this.eventBus.emitEvent(new SuccessMessageEvent(payload.label))
    } catch (error) {
      this.eventBus.emitEvent(new AppErrorEvent(error, 'copy-metadata'))
    }
  }

  public async openUrl(url: string): Promise<void> {
    try {
      await this.externalLink.open(url)
    } catch (error) {
      this.eventBus.emitEvent(new AppErrorEvent(error, 'open-metadata-url'))
    }
  }

  public openReference(ref: TMetadataReferenceTarget): void {
    if (!this.target) {
      return
    }

    const clusterId = this.target.clusterId
    if (ref.routeKind === 'helm') {
      void this.$router.push(ClusterRoutes.helm(clusterId))
      return
    }

    const served = this.discoveryStore.kindsOf(clusterId)
    if (ref.routeKind === 'argocd') {
      const appKind = KubeKindLocator.find(
        served,
        ref.apiVersion || 'argoproj.io/v1alpha1',
        ref.kindName || 'Application',
      )
      if (appKind && ref.name) {
        this.$emit('open', this.relatedOf(ref, appKind))
        return
      }

      void this.$router.push(ClusterRoutes.argocd(clusterId))
      return
    }

    const kind = KubeKindLocator.find(served, ref.apiVersion, ref.kindName)
      ?? KubeKindLocator.find(KubeResourceRegistry.all(), ref.apiVersion, ref.kindName)
    if (!kind || !ref.name) {
      return
    }

    this.$emit('open', this.relatedOf(ref, kind))
  }

  private relatedOf(ref: TMetadataReferenceTarget, kind: KubeResourceKind): TRelatedObject {
    const namespace = kind.namespaced ? ref.namespace : ''

    return {
      key: `${kind.key}/${namespace}/${ref.name}`,
      kindName: kind.kind,
      name: ref.name,
      namespace,
      kind,
      detail: '',
    }
  }
}
</script>
