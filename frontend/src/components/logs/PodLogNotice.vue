<template>
  <div v-if="visible" :class="['pod-log-notice', toneClass]">
    <ui-status-badge :label="headline" :tone="tone" />

    <p v-if="detail" class="truncate text-xs text-muted-foreground">{{ detail }}</p>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <button
          v-if="canReconnect"
          class="btn-secondary h-7 px-2 text-xs"
          type="button"
          @click="$emit('reconnect')"
      >
        <rotate-cw :size="12" />
        <span>{{ reconnectLabel }}</span>
      </button>

      <button
          v-if="canShowPrevious"
          class="btn-secondary h-7 px-2 text-xs"
          type="button"
          @click="$emit('previous')"
      >
        <history :size="12" />
        <span>Show previous</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { History, RotateCw } from '@lucide/vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TPodLogState } from '@/domain/models/kube'

@Component({
  components: { History, RotateCw, UiStatusBadge },
  emits: ['reconnect', 'previous'],
})
export default class PodLogNotice extends VueBase {
  @Prop({ required: true })
  public readonly state: TPodLogState

  @Prop({ required: true })
  public readonly previous: boolean

  @Prop({ required: false, default: '' })
  public readonly failure?: string

  public get visible(): boolean {
    return this.state === 'restarted' || this.state === 'failed' || this.state === 'ended'
  }

  public get tone(): TUiTone {
    if (this.state === 'failed') {
      return 'error'
    }

    return this.state === 'restarted' ? 'warning' : 'unknown'
  }

  public get toneClass(): string {
    if (this.state === 'failed') {
      return 'pod-log-notice-error'
    }

    return this.state === 'restarted' ? 'pod-log-notice-warning' : ''
  }

  public get headline(): string {
    if (this.state === 'failed') {
      return 'Stream stopped'
    }
    if (this.state === 'restarted') {
      return 'Container restarted'
    }

    return this.previous ? 'End of the previous log' : 'End of log'
  }

  public get detail(): string {
    if (this.state === 'failed') {
      return this.failure ?? ''
    }
    if (this.state === 'restarted') {
      return 'The cluster closed this log because the container it belonged to went away.'
    }

    return ''
  }

  public get canReconnect(): boolean {
    return this.state !== 'ended' || this.previous
  }

  public get reconnectLabel(): string {
    return this.previous ? 'Back to current' : 'Reconnect'
  }

  public get canShowPrevious(): boolean {
    return !this.previous && this.state !== 'ended'
  }
}
</script>

<style scoped>
.pod-log-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding-inline: 12px;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 0.5);
  font-size: 12px;
}

.pod-log-notice-warning {
  background-color: hsl(var(--warning) / 0.1);
  border-bottom-color: hsl(var(--warning) / 0.3);
}

.pod-log-notice-error {
  background-color: hsl(var(--destructive) / 0.1);
  border-bottom-color: hsl(var(--destructive) / 0.3);
}
</style>
