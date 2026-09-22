<template>
  <!-- One scroll box per tab, so the tab bar above stays put and a long tab scrolls to its end. -->
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="tab === tabs.overviewKey" class="min-h-0 flex-1 overflow-y-auto">
      <argo-application-overview-tab :application="application" @automated="$emit('automated', $event)" />
    </div>

    <div v-else-if="tab === tabs.resourcesKey" class="min-h-0 flex-1 overflow-y-auto">
      <argo-application-resources-tab :cluster-id="clusterId" :resources="application.resources" />
    </div>

    <div v-else-if="tab === tabs.historyKey" class="min-h-0 flex-1 overflow-y-auto">
      <argo-application-history-tab
          :busy="busy"
          :can-sync="canSync"
          :current-revision="application.syncedRevision"
          :history="application.history"
          @rollback="$emit('rollback', $event)"
      />
    </div>

    <div v-else class="min-h-0 flex-1 overflow-y-auto">
      <argo-application-conditions-tab :conditions="application.conditions" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ArgoApplicationConditionsTab from '@/components/argocd/detail/ArgoApplicationConditionsTab.vue'
import ArgoApplicationHistoryTab from '@/components/argocd/detail/ArgoApplicationHistoryTab.vue'
import ArgoApplicationOverviewTab from '@/components/argocd/detail/ArgoApplicationOverviewTab.vue'
import ArgoApplicationResourcesTab from '@/components/argocd/detail/ArgoApplicationResourcesTab.vue'
import { ArgoDetailTabs } from '@/components/argocd/detail/ArgoDetailTabs'
import type { ArgoApplicationEntity } from '@/domain/entities/argocd/ArgoApplicationEntity'

@Component({
  components: {
    ArgoApplicationConditionsTab,
    ArgoApplicationHistoryTab,
    ArgoApplicationOverviewTab,
    ArgoApplicationResourcesTab,
  },
  emits: ['automated', 'rollback'],
})
export default class ArgoApplicationDetailBody extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly application: ArgoApplicationEntity

  @Prop({ required: true })
  public readonly tab: string

  @Prop({ required: false, default: false })
  public readonly canSync?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get tabs(): typeof ArgoDetailTabs {
    return ArgoDetailTabs
  }
}
</script>
