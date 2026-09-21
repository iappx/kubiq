<template>
  <div class="flex h-full min-h-0 flex-col">
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

    <template v-else-if="detail">
      <helm-release-overview-tab v-if="tab === tabs.overviewKey" :detail="detail" :row="row" />

      <helm-release-values-tab v-else-if="tab === tabs.valuesKey" :detail="detail" class="flex-1 min-h-0" />

      <helm-release-resources-tab
          v-else-if="tab === tabs.resourcesKey"
          :cluster-id="clusterId"
          :resources="detail.resources"
      />

      <helm-release-manifest-tab v-else-if="tab === tabs.manifestKey" :detail="detail" class="flex-1 min-h-0" />

      <helm-release-notes-tab v-else-if="tab === tabs.notesKey" :detail="detail" />

      <helm-release-history-tab
          v-else-if="tab === tabs.historyKey"
          :busy="busy"
          :current-revision="row.revision"
          :revisions="detail.revisions"
          @rollback="$emit('rollback', $event)"
      />
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
