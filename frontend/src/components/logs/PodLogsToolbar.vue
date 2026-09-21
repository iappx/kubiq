<template>
  <div class="pod-log-toolbar">
    <pod-log-menu-button
        v-if="containerItems.length > 0"
        :items="containerItems"
        :value="containerValue"
        label="Container"
        @select="openContainer($event)"
    />

    <span class="pod-log-divider" />

    <ui-search-field
        :model-value="search"
        class="w-56"
        placeholder="Search this log"
        @update:model-value="podLogsStore.setSearch(sessionKey, $event)"
    />

    <pod-log-toggle
        :icon="listFilterIcon"
        :pressed="onlyMatches"
        label="Show only matching lines"
        @toggle="podLogsStore.setOnlyMatches(sessionKey, $event)"
    />

    <span class="pod-log-divider" />

    <pod-log-toggle
        :icon="wrapIcon"
        :pressed="wrap"
        label="Wrap long lines"
        @toggle="podLogsStore.setWrap(sessionKey, $event)"
    />

    <pod-log-toggle
        :icon="clockIcon"
        :pressed="timestamps"
        label="Show timestamps"
        @toggle="setTimestamps($event)"
    />

    <pod-log-toggle
        :icon="tagIcon"
        :pressed="showContainer"
        label="Show the container name on every line"
        @toggle="podLogsStore.setShowContainer(sessionKey, $event)"
    />

    <pod-log-toggle
        :icon="historyIcon"
        :pressed="previous"
        label="Read the previous container's log"
        @toggle="setPrevious($event)"
    />

    <span class="pod-log-divider" />

    <pod-log-menu-button
        :items="tailItems"
        :value="tailValue"
        label="How many lines to load"
        @select="setTail($event)"
    />

    <pod-log-menu-button
        :items="sinceItems"
        :value="sinceValue"
        label="How far back to start"
        @select="setSince($event)"
    />

    <div class="ml-auto flex shrink-0 items-center gap-1 pl-2">
      <button
          aria-label="Save this log to a file"
          class="btn-icon w-7 h-7"
          title="Save this log to a file"
          type="button"
          @click="save"
      >
        <download :size="14" />
      </button>

      <button
          aria-label="Copy this log to the clipboard"
          class="btn-icon w-7 h-7"
          title="Copy this log to the clipboard"
          type="button"
          @click="copy"
      >
        <copy :size="14" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Clock, Copy, Download, History, ListFilter, Tag, WrapText } from '@lucide/vue'
import type { Component as VueComponent } from 'vue'
import PodLogMenuButton from '@/components/logs/PodLogMenuButton.vue'
import PodLogToggle from '@/components/logs/PodLogToggle.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import { OpenPodLogsEvent } from '@/domain/events/cluster/OpenPodLogsEvent'
import { PodLogOptions, PodLogSinceCatalog, PodLogTailCatalog } from '@/domain/models/kube'
import type { TPodLogOptions } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'
import type { TPodLogView } from '@/store/modules/podLogs/types/TPodLogView'

@Component({
  components: { Copy, Download, PodLogMenuButton, PodLogToggle, UiSearchField },
})
export default class PodLogsToolbar extends VueBase {
  @Prop({ required: true })
  public readonly sessionKey: string

  constructor(
      @inject(EventBus) private readonly eventBus: EventBus,
      @inject(PodLogsStore) public readonly podLogsStore: PodLogsStore,
  ) {
    super()
  }

  public get view(): TPodLogView | undefined {
    return this.podLogsStore.viewOf(this.sessionKey)
  }

  public get options(): TPodLogOptions {
    return this.view?.options ?? PodLogOptions.defaults()
  }

  public get search(): string {
    return this.view?.search ?? ''
  }

  public get onlyMatches(): boolean {
    return this.view?.onlyMatches === true
  }

  public get wrap(): boolean {
    return this.view?.wrap === true
  }

  public get showContainer(): boolean {
    return this.view?.showContainer === true
  }

  public get timestamps(): boolean {
    return this.options.timestamps
  }

  public get previous(): boolean {
    return this.options.previous
  }

  public get containerItems(): TUiMenuItem[] {
    return (this.view?.containers ?? []).map(container => ({
      key: container.name,
      label: container.isInit ? `${container.name} · init` : container.name,
    }))
  }

  public get containerValue(): string {
    return this.options.container === '' ? 'Default container' : this.options.container
  }

  public get tailItems(): TUiMenuItem[] {
    return Object.entries(PodLogTailCatalog.values).map(([key, label]) => ({ key, label }))
  }

  public get tailValue(): string {
    return PodLogTailCatalog.title(this.options.tailLines)
  }

  public get sinceItems(): TUiMenuItem[] {
    return Object.entries(PodLogSinceCatalog.values).map(([key, label]) => ({ key, label }))
  }

  public get sinceValue(): string {
    return PodLogSinceCatalog.title(this.options.sinceSeconds)
  }

  public get clockIcon(): VueComponent {
    return Clock
  }

  public get historyIcon(): VueComponent {
    return History
  }

  public get listFilterIcon(): VueComponent {
    return ListFilter
  }

  public get tagIcon(): VueComponent {
    return Tag
  }

  public get wrapIcon(): VueComponent {
    return WrapText
  }

  public openContainer(container: string): void {
    const view = this.view
    if (!view || container === this.options.container) {
      return
    }

    this.eventBus.emitEvent(new OpenPodLogsEvent(
      view.clusterId,
      view.namespace,
      view.podName,
      container,
      this.options.previous,
    ))
  }

  public setTimestamps(timestamps: boolean): void {
    void this.podLogsStore.applyOptions(this.sessionKey, { ...this.options, timestamps })
  }

  public setPrevious(previous: boolean): void {
    void this.podLogsStore.applyOptions(this.sessionKey, PodLogOptions.forPrevious(this.options, previous))
  }

  public setTail(tailLines: string): void {
    void this.podLogsStore.applyOptions(this.sessionKey, { ...this.options, tailLines: Number(tailLines) })
  }

  public setSince(sinceSeconds: string): void {
    void this.podLogsStore.applyOptions(this.sessionKey, {
      ...this.options,
      sinceSeconds: Number(sinceSeconds),
      sinceTime: '',
    })
  }

  public save(): void {
    void this.podLogsStore.save(this.sessionKey)
  }

  public copy(): void {
    void this.podLogsStore.copy(this.sessionKey)
  }
}
</script>

<style scoped>
.pod-log-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding-inline: 8px;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
  overflow-x: auto;
}

.pod-log-divider {
  flex: none;
  width: 1px;
  height: 16px;
  margin-inline: 4px;
  background-color: hsl(var(--border));
}
</style>
