<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ui-error-state
        v-if="error"
        :detail="errorDetail"
        :message="error"
        title="Could not read this release"
        @retry="$emit('retry')"
    />

    <ui-deferred-loader v-else-if="loading" :loading="true">
      <template #loading>
        <ui-skeletons :count="4" type="rows" />
      </template>
    </ui-deferred-loader>

    <!-- One scroll box per tab, so the tab bar above stays put and a long tab scrolls to its end. -->
    <template v-else-if="detail">
      <div v-if="tab === tabs.overviewKey" class="min-h-0 flex-1 overflow-y-auto">
        <helm-release-overview-tab :detail="detail" :row="row" />
      </div>

      <helm-release-values-tab v-else-if="tab === tabs.valuesKey" :detail="detail" class="flex-1 min-h-0" />

      <div v-else-if="tab === tabs.resourcesKey" class="min-h-0 flex-1 overflow-y-auto">
        <helm-release-resources-tab :cluster-id="clusterId" :resources="detail.resources" />
      </div>

      <helm-release-manifest-tab v-else-if="tab === tabs.manifestKey" :detail="detail" class="flex-1 min-h-0" />

      <div v-else-if="tab === tabs.notesKey" class="min-h-0 flex-1 overflow-y-auto">
        <helm-release-notes-tab :detail="detail" />
      </div>

      <div v-else-if="tab === tabs.historyKey" class="min-h-0 flex-1 overflow-y-auto">
        <helm-release-history-tab
            :busy="busy"
            :current-revision="row.revision"
            :revisions="detail.revisions"
            @rollback="$emit('rollback', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import HelmReleaseHistoryTab from '@/components/helm/detail/HelmReleaseHistoryTab.vue'
import HelmReleaseManifestTab from '@/components/helm/detail/HelmReleaseManifestTab.vue'
import HelmReleaseNotesTab from '@/components/helm/detail/HelmReleaseNotesTab.vue'
import HelmReleaseOverviewTab from '@/components/helm/detail/HelmReleaseOverviewTab.vue'
import HelmReleaseResourcesTab from '@/components/helm/detail/HelmReleaseResourcesTab.vue'
import HelmReleaseValuesTab from '@/components/helm/detail/HelmReleaseValuesTab.vue'
import { HelmDetailTabs } from '@/components/helm/detail/HelmDetailTabs'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import type { THelmReleaseDetail } from '@/store/modules/helm/types/THelmReleaseDetail'

@Component({
  components: {
    HelmReleaseHistoryTab,
    HelmReleaseManifestTab,
    HelmReleaseNotesTab,
    HelmReleaseOverviewTab,
    HelmReleaseResourcesTab,
    HelmReleaseValuesTab,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
  },
  emits: ['retry', 'rollback'],
})
export default class HelmReleaseDetailBody extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly row: THelmReleaseRow

  @Prop({ required: true })
  public readonly tab: string

  @Prop({ required: false, default: null })
  public readonly detail: THelmReleaseDetail | null

  @Prop({ required: false, default: false })
  public readonly loading?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  @Prop({ required: false, default: '' })
  public readonly error?: string

  @Prop({ required: false, default: '' })
  public readonly errorDetail?: string

  public get tabs(): typeof HelmDetailTabs {
    return HelmDetailTabs
  }
}
</script>
