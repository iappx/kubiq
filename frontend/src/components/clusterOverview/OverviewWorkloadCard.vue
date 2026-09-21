<template>
  <router-link v-slot="{ href, navigate }" :to="path" custom>
    <a :href="href" class="surface p-4 flex items-center gap-3 hover:border-ring transition-colors" @click="navigate">
      <span class="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <kube-icon :name="summary.icon" :size="16" />
      </span>

      <span class="min-w-0 flex-1">
        <span class="block text-xs text-muted-foreground truncate">{{ summary.title }}</span>
        <span class="block text-xl font-semibold text-foreground tabular leading-tight">{{ countLabel }}</span>
      </span>

      <ui-status-badge v-if="summary.error" :label="errorLabel" tone="unknown" />
      <ui-status-badge v-else-if="summary.problems > 0" :label="problemLabel" tone="warning" />
      <ui-status-badge v-else label="Healthy" tone="ok" />
    </a>
  </router-link>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import KubeIcon from '@/components/common/icon/KubeIcon.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'

@Component({
  components: { KubeIcon, UiStatusBadge },
})
export default class OverviewWorkloadCard extends VueBase {
  @Prop({ required: true })
  public readonly summary: TWorkloadSummary

  @Prop({ required: true })
  public readonly clusterId: string

  public get path(): string {
    return ClusterRoutes.resource(this.clusterId, this.summary.section, this.summary.slug)
  }

  public get countLabel(): string {
    return this.summary.error ? '—' : String(this.summary.total)
  }

  public get problemLabel(): string {
    return `${this.summary.problems} need attention`
  }

  public get errorLabel(): string {
    return 'Not readable'
  }
}
</script>
