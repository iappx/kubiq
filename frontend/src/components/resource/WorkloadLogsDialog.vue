<template>
  <ui-modal
      :loading="loading"
      :open="open"
      :title="title"
      submit-label="View logs"
      @close="$emit('cancel')"
      @submit="submitFirst"
  >
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        Select a pod to open its logs.
      </p>

      <div
          v-if="loading"
          class="flex items-center justify-center gap-2 rounded-md border border-border py-8 text-xs text-muted-foreground"
      >
        <loader-circle :size="16" class="animate-spin" />
        <span>Finding pods…</span>
      </div>

      <div
          v-else-if="pods.length === 0"
          class="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground"
      >
        No pods currently match this workload
      </div>

      <div
          v-else
          class="max-h-72 overflow-y-auto divide-y divide-border rounded-md border border-border"
      >
        <button
            v-for="pod in pods"
            :key="`${pod.namespace}/${pod.name}`"
            class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
            type="button"
            @click="select(pod)"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="truncate font-mono text-xs font-medium text-foreground">
              {{ pod.name }}
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span v-if="pod.nodeName" class="truncate">{{ pod.nodeName }}</span>
              <span v-if="pod.nodeName" aria-hidden="true">·</span>
              <span class="tabular shrink-0">{{ containerLabel(pod.containers.length) }}</span>
            </div>
          </div>

          <ui-status-badge :label="pod.phase" :tone="pod.tone" class="shrink-0 text-xs" />
        </button>
      </div>
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle } from '@lucide/vue'
import type { TWorkloadPodChoice } from '@/application/services/workloadLogs/types/TWorkloadPodChoice'
import UiModal from '@/components/common/modal/UiModal.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'

@Component({
  components: { LoaderCircle, UiModal, UiStatusBadge },
  emits: ['select', 'cancel'],
})
export default class WorkloadLogsDialog extends VueBase {
  @Prop({ required: true, type: Boolean })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly workloadKind: string

  @Prop({ required: true })
  public readonly workloadName: string

  @Prop({ required: true })
  public readonly pods: TWorkloadPodChoice[]

  @Prop({ required: false, type: Boolean, default: false })
  public readonly loading?: boolean

  public get title(): string {
    return `Logs for ${this.workloadKind} ${this.workloadName}`.trim()
  }

  public containerLabel(count: number): string {
    return count === 1 ? '1 container' : `${count} containers`
  }

  public select(pod: TWorkloadPodChoice): void {
    this.$emit('select', pod)
  }

  public submitFirst(): void {
    if (this.loading || this.pods.length === 0) {
      return
    }

    this.$emit('select', this.pods[0])
  }
}
</script>
