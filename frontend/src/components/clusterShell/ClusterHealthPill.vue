<template>
  <span
      v-if="!settled"
      :class="pillClass"
      :title="notice.description"
      class="pill gap-1"
      role="status"
  >
    <ui-status-dot :size="8" :tone="tone" />
    {{ notice.title }}

    <button
        v-if="canReconnect"
        class="ml-1 underline underline-offset-2 hover:no-underline"
        type="button"
        @click="$emit('reconnect')"
    >
      Reconnect
    </button>
  </span>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TClusterHealthNotice } from '@/domain/models/kube'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'

@Component({
  components: { UiStatusDot },
  emits: ['reconnect'],
})
export default class ClusterHealthPill extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  constructor(
      @inject(ClusterHealthStore) public readonly healthStore: ClusterHealthStore,
  ) {
    super()
  }

  public get settled(): boolean {
    return this.clusterId === '' || this.healthStore.isSettled(this.clusterId)
  }

  public get notice(): TClusterHealthNotice {
    return this.healthStore.noticeOf(this.clusterId)
  }

  public get canReconnect(): boolean {
    return this.healthStore.online && this.healthStore.needsReconnect(this.clusterId)
  }

  public get tone(): TUiTone {
    if (!this.healthStore.online) {
      return 'warning'
    }

    return this.healthStore.healthOf(this.clusterId) === 'degraded' ? 'warning' : 'error'
  }

  public get pillClass(): string {
    return this.tone === 'warning'
        ? 'text-warning border-warning/30 bg-warning/10'
        : 'text-destructive border-destructive/30 bg-destructive/10'
  }
}
</script>
