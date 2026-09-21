<template>
  <div v-if="view" class="pod-log-status">
    <ui-status-badge :label="stateLabel" :tone="tone" />

    <span class="pod-log-count tabular">{{ lineText }}</span>

    <span v-if="view.dropped > 0" :title="dropTitle" class="pod-log-count tabular">{{ dropText }}</span>

    <span v-if="matchText" class="ml-auto pod-log-count tabular">{{ matchText }}</span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { PodLogHighlighter } from '@/components/logs/PodLogHighlighter'
import { PodLogLimits } from '@/application/services/podLogs/constants/PodLogLimits'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'
import type { TPodLogView } from '@/store/modules/podLogs/types/TPodLogView'

@Component({
  components: { UiStatusBadge },
})
export default class PodLogStatus extends VueBase {
  @Prop({ required: true })
  public readonly sessionKey: string

  constructor(
      @inject(PodLogsStore) private readonly podLogsStore: PodLogsStore,
  ) {
    super()
  }

  public get view(): TPodLogView | undefined {
    return this.podLogsStore.viewOf(this.sessionKey)
  }

  public get tone(): TUiTone {
    const tones: Record<string, TUiTone> = {
      connecting: 'pending',
      streaming: 'ok',
      ended: 'unknown',
      restarted: 'warning',
      failed: 'error',
    }

    return tones[this.view?.state ?? 'connecting'] ?? 'unknown'
  }

  public get stateLabel(): string {
    const state = this.view?.state ?? 'connecting'
    if (state === 'streaming') {
      return this.view?.options.follow === true ? 'Streaming' : 'Loaded'
    }

    const labels: Record<string, string> = {
      connecting: 'Connecting',
      ended: 'Ended',
      restarted: 'Restarted',
      failed: 'Stopped',
    }

    return labels[state] ?? 'Unknown'
  }

  public get lineText(): string {
    const count = this.view?.lineCount ?? 0

    return `${count.toLocaleString('en')} ${count === 1 ? 'line' : 'lines'}`
  }

  public get dropText(): string {
    return `${(this.view?.dropped ?? 0).toLocaleString('en')} dropped`
  }

  public get dropTitle(): string {
    return `The buffer holds the most recent ${PodLogLimits.lines.toLocaleString('en')} lines; older ones are discarded as new ones arrive.`
  }

  public get matchText(): string {
    const view = this.view
    if (!view || view.search === '') {
      return ''
    }

    // Touches the revision so the getter re-runs: the line buffer itself is not reactive.
    void view.revision
    const matches = PodLogHighlighter.count(this.podLogsStore.lines(this.sessionKey), view.search)

    return `${matches.toLocaleString('en')} matching ${matches === 1 ? 'line' : 'lines'}`
  }
}
</script>

<style scoped>
.pod-log-status {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 24px;
  padding-inline: 12px;
  border-top: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
  font-size: var(--density-text);
  color: hsl(var(--muted-foreground));
}

.pod-log-count {
  white-space: nowrap;
}
</style>
