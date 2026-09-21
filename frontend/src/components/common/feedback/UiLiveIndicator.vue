<template>
  <span v-if="state === 'live'" class="pill gap-1 text-success border-success/30 bg-success/10">
    <span class="ui-live-dot inline-flex">
      <ui-status-dot :size="8" tone="ok" />
    </span>
    Live
  </span>

  <span v-else-if="state === 'stale'" class="pill gap-1 text-warning border-warning/30 bg-warning/10">
    <ui-status-dot :size="8" tone="warning" />
    {{ staleLabel }}
    <button
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
import { DateTime } from 'luxon'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'

@Component({
  components: { UiStatusDot },
  emits: ['reconnect'],
})
export default class UiLiveIndicator extends VueBase {
  @Prop({ required: true })
  public readonly state: 'live' | 'stale' | 'off'

  @Prop({ required: false })
  public readonly since?: string | number | Date | null

  public get staleLabel(): string {
    const at = this.staleAt
    return at === null ? 'Stale' : `Stale since ${at}`
  }

  private get staleAt(): string | null {
    if (this.since === null || this.since === undefined) {
      return null
    }
    const moment = this.since instanceof Date
        ? DateTime.fromJSDate(this.since)
        : (typeof this.since === 'number' ? DateTime.fromMillis(this.since) : DateTime.fromISO(this.since))
    return moment.isValid ? moment.toFormat('HH:mm') : null
  }
}
</script>
