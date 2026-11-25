<template>
  <router-link v-slot="{ href, navigate }" :to="path" custom>
    <a :href="href" class="surface p-3 flex flex-col gap-2 hover:border-ring transition-colors" @click="navigate">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
          <kube-icon :name="summary.icon" :size="14" />
        </span>

        <span class="text-xs font-medium text-foreground truncate flex-1">{{ summary.title }}</span>

        <span class="text-xs font-semibold text-foreground tabular shrink-0">{{ countLabel }}</span>
      </div>

      <div :aria-label="barLabel" class="h-1 w-full rounded-full bg-muted overflow-hidden flex" role="img">
        <span v-if="healthyPercent > 0" :style="{ width: `${healthyPercent}%` }" class="h-1 bg-success" />
        <span v-if="warningPercent > 0" :style="{ width: `${warningPercent}%` }" class="h-1 bg-warning" />
        <span v-if="errorPercent > 0" :style="{ width: `${errorPercent}%` }" class="h-1 bg-destructive" />
      </div>

      <div class="flex items-center justify-between gap-2 min-w-0">
        <span :class="statusClass" class="text-xs truncate">{{ statusLabel }}</span>
        <span v-if="summary.note" class="text-xs text-muted-foreground truncate shrink-0">{{ summary.note }}</span>
      </div>
    </a>
  </router-link>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import KubeIcon from '@/components/common/icon/KubeIcon.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'

@Component({
  components: { KubeIcon },
})
export default class OverviewWorkloadCard extends VueBase {
  @Prop({ required: true })
  public readonly summary: TWorkloadSummary

  @Prop({ required: true })
  public readonly clusterId: string

  public get path(): string {
    return ClusterRoutes.resource(this.clusterId, this.summary.section, this.summary.slug)
  }

  public get healthyCount(): number {
    return this.summary.healthy ?? Math.max(0, this.summary.total - this.summary.problems)
  }

  public get errorCount(): number {
    return this.summary.errors ?? 0
  }

  public get warningCount(): number {
    return this.summary.warnings ?? Math.max(0, this.summary.problems - this.errorCount)
  }

  public get countLabel(): string {
    if (this.summary.error) {
      return '—'
    }
    if (this.summary.total === 0) {
      return '0'
    }

    return `${this.healthyCount} / ${this.summary.total}`
  }

  public get healthyPercent(): number {
    return this.share(this.healthyCount)
  }

  public get warningPercent(): number {
    return this.share(this.warningCount)
  }

  public get errorPercent(): number {
    return this.share(this.errorCount)
  }

  public get statusLabel(): string {
    if (this.summary.error) {
      return 'Not readable'
    }
    if (this.summary.total === 0) {
      return 'None'
    }
    if (this.summary.problems === 0 && this.healthyCount === this.summary.total) {
      return `All ${this.summary.total} healthy`
    }
    if (this.summary.problems > 0) {
      const parts: string[] = []
      if (this.errorCount > 0) {
        parts.push(`${this.errorCount} error`)
      }
      if (this.warningCount > 0) {
        parts.push(`${this.warningCount} warning`)
      }

      return parts.length > 0 ? parts.join(', ') : `${this.summary.problems} need attention`
    }

    return `${this.healthyCount} of ${this.summary.total} healthy`
  }

  public get statusClass(): string {
    if (this.summary.error || this.summary.total === 0) {
      return 'text-muted-foreground'
    }
    if (this.errorCount > 0) {
      return 'text-destructive'
    }
    if (this.summary.problems > 0) {
      return 'text-warning'
    }

    return 'text-success'
  }

  public get barLabel(): string {
    return `${this.summary.title}: ${this.statusLabel}`
  }

  private share(value: number): number {
    if (this.summary.error || this.summary.total <= 0 || value <= 0) {
      return 0
    }

    return Math.min(100, (value / this.summary.total) * 100)
  }
}
</script>
