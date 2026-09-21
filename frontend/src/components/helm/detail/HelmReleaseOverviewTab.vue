<template>
  <div class="space-y-3">
    <ui-section title="Release">
      <helm-fact-list :facts="facts" />
    </ui-section>

    <ui-section v-if="detail" description="What this release currently holds in the cluster" title="Contents">
      <helm-fact-list :facts="contents" />
    </ui-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import HelmFactList from '@/components/helm/detail/HelmFactList.vue'
import type { THelmFact } from '@/components/helm/types/THelmFact'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import type { THelmReleaseDetail } from '@/store/modules/helm/types/THelmReleaseDetail'

@Component({
  components: { HelmFactList, UiSection },
})
export default class HelmReleaseOverviewTab extends VueBase {
  @Prop({ required: true })
  public readonly row: THelmReleaseRow

  @Prop({ required: false, default: null })
  public readonly detail: THelmReleaseDetail | null

  public get facts(): THelmFact[] {
    return [
      { label: 'Namespace', value: this.row.namespace },
      { label: 'Status', value: this.row.statusText },
      { label: 'Revision', value: String(this.row.revision) },
      { label: 'Chart', value: this.row.chart },
      { label: 'Chart version', value: this.row.chartVersion },
      { label: 'App version', value: this.row.appVersion },
      { label: 'Updated', value: this.row.updated, isAge: true },
    ]
  }

  public get contents(): THelmFact[] {
    return [
      { label: 'Objects', value: String(this.detail?.resources.length ?? 0) },
      { label: 'Revisions', value: String(this.detail?.revisions.length ?? 0) },
    ]
  }
}
</script>
