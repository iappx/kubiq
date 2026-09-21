<template>
  <div v-if="view" :data-density="uiStore.density" class="flex h-full min-h-0 flex-col bg-background">
    <pod-logs-toolbar :session-key="sessionKey" />

    <ui-deferred-loader :loading="connecting">
      <template #loading>
        <ui-progress-bar label="Connecting to the log stream" />
      </template>
    </ui-deferred-loader>

    <pod-log-notice
        :failure="view.failure"
        :previous="view.options.previous"
        :state="view.state"
        @previous="showPrevious"
        @reconnect="reconnect"
    />

    <pod-log-viewport :label="label" :prefix="prefix" :session-key="sessionKey" />

    <pod-log-status :session-key="sessionKey" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import PodLogNotice from '@/components/logs/PodLogNotice.vue'
import PodLogStatus from '@/components/logs/PodLogStatus.vue'
import PodLogViewport from '@/components/logs/PodLogViewport.vue'
import PodLogsToolbar from '@/components/logs/PodLogsToolbar.vue'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'
import type { TPodLogView } from '@/store/modules/podLogs/types/TPodLogView'

@Component({
  components: { PodLogNotice, PodLogStatus, PodLogViewport, PodLogsToolbar, UiDeferredLoader, UiProgressBar },
})
export default class PodLogsPanel extends VueBase {
  @Prop({ required: true })
  public readonly sessionKey: string

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(PodLogsStore) private readonly podLogsStore: PodLogsStore,
  ) {
    super()
  }

  public get view(): TPodLogView | undefined {
    return this.podLogsStore.viewOf(this.sessionKey)
  }

  public get connecting(): boolean {
    return this.view?.state === 'connecting'
  }

  public get label(): string {
    const view = this.view
    if (!view) {
      return 'Logs'
    }

    const container = view.options.container === '' ? '' : `/${view.options.container}`

    return `Logs for ${view.namespace}/${view.podName}${container}`
  }

  public get prefix(): string {
    const view = this.view

    return view && view.showContainer && view.options.container !== '' ? view.options.container : ''
  }

  public reconnect(): void {
    void this.podLogsStore.reconnect(this.sessionKey)
  }

  public showPrevious(): void {
    void this.podLogsStore.showPrevious(this.sessionKey)
  }
}
</script>
