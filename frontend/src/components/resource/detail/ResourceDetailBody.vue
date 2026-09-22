<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ui-error-state
        v-if="state.forbidden"
        :hint="forbiddenHint"
        :message="`You cannot read this ${target.kind.kind} in the cluster.`"
        :retryable="false"
        title="Not permitted"
    />

    <ui-error-state
        v-else-if="state.missing"
        :message="`${target.kind.kind} ${target.name} is no longer in the cluster.`"
        :retryable="false"
        title="Gone"
    />

    <ui-error-state
        v-else-if="state.error"
        :detail="state.errorDetail"
        :message="state.error"
        title="Could not read this object"
        @retry="reload"
    />

    <!-- No gate: the panel opens empty on a click, so the blank the gate leaves reads as "no data". -->
    <ui-deferred-loader v-else-if="!state.loaded" :delay="0" :loading="true">
      <template #loading>
        <ui-skeletons :count="4" type="rows" />
      </template>
    </ui-deferred-loader>

    <template v-else>
      <div v-show="tab === tabs.overviewKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-overview-tab :state="state" :target="target" @open="$emit('open', $event)" />
      </div>

      <div v-show="tab === tabs.detailsKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-details-tab :kind="target.kind" :state="state" />
      </div>

      <div v-if="dataOpened" v-show="tab === tabs.dataKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-data-tab :kind="target.kind" :state="state" />
      </div>

      <div v-if="podsOpened" v-show="tab === tabs.podsKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-node-pods-tab :target="target" @open="$emit('open', $event)" />
      </div>

      <div v-if="environmentOpened" v-show="tab === tabs.environmentKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-environment-tab :state="state" :target="target" />
      </div>

      <div v-show="tab === tabs.metadataKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-metadata-tab :object="state.object" />
      </div>

      <div v-if="eventsOpened" v-show="tab === tabs.eventsKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-events-tab :state="state" @reconnect="loadEvents" />
      </div>

      <resource-yaml-tab
          v-if="yamlOpened"
          v-show="tab === tabs.yamlKey"
          :state="state"
          :target="target"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import ResourceDataTab from '@/components/resource/detail/ResourceDataTab.vue'
import ResourceDetailsTab from '@/components/resource/detail/ResourceDetailsTab.vue'
import ResourceEnvironmentTab from '@/components/resource/detail/ResourceEnvironmentTab.vue'
import ResourceEventsTab from '@/components/resource/detail/ResourceEventsTab.vue'
import ResourceMetadataTab from '@/components/resource/detail/ResourceMetadataTab.vue'
import ResourceNodePodsTab from '@/components/resource/detail/ResourceNodePodsTab.vue'
import ResourceOverviewTab from '@/components/resource/detail/ResourceOverviewTab.vue'
import ResourceYamlTab from '@/components/resource/detail/ResourceYamlTab.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { KubeAccessHint } from '@/domain/models/kube'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: {
    ResourceDataTab,
    ResourceDetailsTab,
    ResourceEnvironmentTab,
    ResourceEventsTab,
    ResourceMetadataTab,
    ResourceNodePodsTab,
    ResourceOverviewTab,
    ResourceYamlTab,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
  },
  emits: ['open'],
})
export default class ResourceDetailBody extends VueBase {
  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  @Prop({ required: true })
  public readonly tab: string

  public dataOpened = false

  public podsOpened = false

  public environmentOpened = false

  public eventsOpened = false

  public yamlOpened = false

  constructor(
      @inject(ResourceObjectStore) public readonly objectStore: ResourceObjectStore,
  ) {
    super()
  }

  public get state(): TResourceObjectState {
    return this.objectStore.stateOf(this.target)
  }

  public get tabs(): typeof DetailTabs {
    return DetailTabs
  }

  public get forbiddenHint(): string {
    return KubeAccessHint.of('get', this.target.kind, this.target.namespace)
  }

  async created(): Promise<void> {
    await this.objectStore.load(this.target)
    this.openTab(this.tab)
  }

  async beforeUnmount(): Promise<void> {
    await this.objectStore.stopEvents(this.target)
  }

  @Watch('tab')
  tabChanged(tab: string): void {
    this.openTab(tab)
  }

  public reload(): Promise<void> {
    return this.objectStore.load(this.target)
  }

  public loadEvents(): Promise<void> {
    return this.objectStore.loadEvents(this.target)
  }

  public loadEnvironment(): Promise<void> {
    return this.objectStore.loadEnvironment(this.target)
  }

  private openTab(tab: string): void {
    if (!this.state.loaded) {
      return
    }
    if (tab === DetailTabs.yamlKey) {
      this.yamlOpened = true
    }
    if (tab === DetailTabs.dataKey) {
      this.dataOpened = true
    }
    if (tab === DetailTabs.podsKey) {
      this.podsOpened = true
    }
    if (tab === DetailTabs.environmentKey && !this.environmentOpened) {
      this.environmentOpened = true
      void this.loadEnvironment()
    }
    if (tab !== DetailTabs.eventsKey || this.eventsOpened) {
      return
    }

    this.eventsOpened = true
    void this.loadEvents()
  }
}
</script>
