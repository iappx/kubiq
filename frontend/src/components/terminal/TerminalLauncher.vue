<template>
  <div class="flex items-center gap-1">
    <ui-dropdown-menu :items="items" @select="choose($event)">
      <template #trigger>
        <button aria-label="Open a terminal" class="btn-icon w-7 h-7" title="Open a terminal" type="button">
          <plus :size="14" />
        </button>
      </template>
    </ui-dropdown-menu>

    <node-shell-dialog
        :cluster-id="clusterId"
        :open="nodeDialogOpen"
        @cancel="nodeDialogOpen = false"
        @confirm="openNodeShell($event)"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Cable, Plus, Server, SquareTerminal } from '@lucide/vue'
import UiDropdownMenu from '@/components/common/menu/UiDropdownMenu.vue'
import NodeShellDialog from '@/components/terminal/NodeShellDialog.vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import { OpenLocalShellEvent } from '@/domain/events/terminal/OpenLocalShellEvent'
import { OpenNodeShellEvent } from '@/domain/events/terminal/OpenNodeShellEvent'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'

@Component({
  components: { NodeShellDialog, Plus, UiDropdownMenu },
})
export default class TerminalLauncher extends VueBase {
  public static readonly localKey = 'local'

  public static readonly nodeKey = 'node'

  public static readonly forwardKey = 'forward'

  @Prop({ required: true })
  public readonly clusterId: string

  public nodeDialogOpen = false

  constructor(
      @inject(EventBus) private readonly eventBus: EventBus,
      @inject(ClusterConnectionStore) private readonly connectionStore: ClusterConnectionStore,
  ) {
    super()
  }

  public get items(): TUiMenuItem[] {
    return [
      { key: TerminalLauncher.localKey, label: 'Local shell', icon: SquareTerminal },
      { key: TerminalLauncher.nodeKey, label: 'Node shell', icon: Server },
      { key: TerminalLauncher.forwardKey, label: 'Port forwards', icon: Cable, separatorBefore: true },
    ]
  }

  public choose(key: string): void {
    if (key === TerminalLauncher.localKey) {
      this.eventBus.emitEvent(new OpenLocalShellEvent(this.clusterId, this.namespace))
      return
    }
    if (key === TerminalLauncher.nodeKey) {
      this.nodeDialogOpen = true
      return
    }

    this.eventBus.emitEvent(new OpenPortForwardEvent(this.clusterId, this.namespace, 'pods', '', 0))
  }

  public openNodeShell(nodeName: string): void {
    this.nodeDialogOpen = false
    this.eventBus.emitEvent(new OpenNodeShellEvent(this.clusterId, nodeName))
  }

  private get namespace(): string {
    return this.connectionStore.namespacesOf(this.clusterId)[0] ?? ''
  }
}
</script>
