<template>
  <div v-if="view" :data-density="uiStore.density" class="flex h-full min-h-0 flex-col bg-background">
    <terminal-toolbar
        :container-name="view.containerName"
        :containers="view.containers"
        :search="search"
        :title="title"
        @find-next="findNext"
        @find-previous="findPrevious"
        @restart="restart"
        @select-container="selectContainer($event)"
        @update:search="search = $event"
    />

    <ui-deferred-loader :loading="starting">
      <template #loading>
        <ui-progress-bar label="Starting the session" />
      </template>
    </ui-deferred-loader>

    <terminal-notice
        :failure="view.failure"
        :hint="view.hint"
        :state="view.state"
        @install="openInstallGuide"
        @restart="restart"
    />

    <terminal-view
        ref="terminal"
        :label="title"
        :search="search"
        :session-key="sessionKey"
        class="flex-1"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import TerminalNotice from '@/components/terminal/TerminalNotice.vue'
import TerminalToolbar from '@/components/terminal/TerminalToolbar.vue'
import TerminalView from '@/components/terminal/TerminalView.vue'
import { TerminalTools } from '@/application/services/terminal/constants/TerminalTools'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { TerminalStore } from '@/store/modules/terminal/TerminalStore'
import type { TTerminalView } from '@/store/modules/terminal/types/TTerminalView'

@Component({
  components: { TerminalNotice, TerminalToolbar, TerminalView, UiDeferredLoader, UiProgressBar },
})
export default class TerminalPanel extends VueBase {
  @Prop({ required: true })
  public readonly sessionKey: string

  public search = ''

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(TerminalStore) private readonly terminalStore: TerminalStore,
  ) {
    super()
  }

  public get view(): TTerminalView | undefined {
    return this.terminalStore.viewOf(this.sessionKey)
  }

  public get starting(): boolean {
    return this.view?.state === 'starting'
  }

  public get title(): string {
    return this.view?.title ?? 'Terminal'
  }

  public findNext(): void {
    this.terminal?.findNext()
  }

  public findPrevious(): void {
    this.terminal?.findPrevious()
  }

  public restart(): void {
    void this.terminalStore.restart(this.sessionKey)
  }

  public selectContainer(containerName: string): void {
    void this.terminalStore.selectContainer(this.sessionKey, containerName)
  }

  public openInstallGuide(): void {
    this.terminalStore.openLink(TerminalTools.kubectlDocs)
  }

  private get terminal(): { findNext(): void, findPrevious(): void } | undefined {
    return this.$refs.terminal as { findNext(): void, findPrevious(): void } | undefined
  }
}
</script>
