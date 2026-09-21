<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ui-error-state
        v-if="state.forbidden"
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

    <ui-deferred-loader v-else-if="!state.loaded" :loading="true">
      <template #loading>
        <ui-skeletons :count="4" type="rows" />
      </template>
    </ui-deferred-loader>

    <template v-else>
      <div v-show="tab === tabs.overviewKey" class="min-h-0 flex-1 overflow-y-auto">
        <resource-overview-tab :kind="target.kind" :state="state" @open="$emit('open', $event)" />
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
import ResourceEventsTab from '@/components/resource/detail/ResourceEventsTab.vue'
import ResourceMetadataTab from '@/components/resource/detail/ResourceMetadataTab.vue'
import ResourceOverviewTab from '@/components/resource/detail/ResourceOverviewTab.vue'
import ResourceYamlTab from '@/components/resource/detail/ResourceYamlTab.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: {
    ResourceEventsTab,
    ResourceMetadataTab,
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

  private openTab(tab: string): void {
    if (!this.state.loaded) {
      return
    }
    if (tab === DetailTabs.yamlKey) {
      this.yamlOpened = true
    }
    if (tab !== DetailTabs.eventsKey || this.eventsOpened) {
      return
    }

    this.eventsOpened = true
    void this.loadEvents()
  }
}
</script>
