<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-24">
        <div class="absolute inset-0 bg-foreground/20" @click="close" />

        <div
            ref="panel"
            :aria-labelledby="titleId"
            aria-modal="true"
            class="surface-raised relative z-10 w-full max-w-xl modal-panel overflow-hidden"
            role="dialog"
        >
          <h2 :id="titleId" class="sr-only">{{ label }}</h2>

          <div class="flex items-center gap-2 px-3 border-b border-border">
            <search :size="14" aria-hidden="true" class="text-muted-foreground shrink-0" />
            <input
                ref="field"
                :aria-label="label"
                :value="query"
                class="flex-1 h-10 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Jump to a kind, a namespace or a cluster"
                type="text"
                @input="onInput"
                @keydown="onKeydown"
            >
          </div>

          <ul v-if="visible.length > 0" class="max-h-80 overflow-y-auto p-1" role="listbox">
            <li
                v-for="(item, index) in visible"
                :key="item.key"
                :aria-selected="index === cursor"
                role="option"
            >
              <button
                  :class="['ui-command-item', index === cursor ? 'ui-command-item-active' : '']"
                  type="button"
                  @click="choose(item)"
                  @mousemove="cursor = index"
              >
                <kube-icon :name="item.icon ?? ''" :size="14" />
                <span class="truncate">{{ item.label }}</span>
                <span v-if="item.hint" class="ml-auto pl-3 truncate text-xs text-muted-foreground">{{ item.hint }}</span>
                <span class="pill shrink-0">{{ item.group }}</span>
              </button>
            </li>
          </ul>

          <p v-else class="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing matches <span class="text-foreground">{{ query }}</span>
          </p>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import { Component, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Search } from '@lucide/vue'
import KubeIcon from '@/components/common/icon/KubeIcon.vue'
import { ModalShellBase } from '@/components/base/modals/ModalShellBase'
import { CommandPaletteIndex } from '@/components/clusterShell/CommandPaletteIndex'
import type { TCommandItem } from '@/components/clusterShell/types/TCommandItem'
import { IdService } from '@/application/services/id/IdService'
import { OpenCommandPaletteEvent } from '@/domain/events/app/OpenCommandPaletteEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

@Component({
  components: { KubeIcon, Search },
})
export default class CommandPalette extends ModalShellBase {
  public open = false

  public query = ''

  public cursor = 0

  public recentKeys: string[] = []

  public titleId = ''

  private onOpenRequested!: (event: OpenCommandPaletteEvent) => void

  constructor(
      @inject(IdService) private readonly idService: IdService,
      @inject(EventBus) private readonly eventBus: EventBus,
      @inject(ClusterConnectionStore) private readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
  ) {
    super()
  }

  public get label(): string {
    return 'Command palette'
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public get visible(): TCommandItem[] {
    const items = CommandPaletteIndex.build({
      clusterId: this.clusterId,
      connections: this.connectionStore.connections,
      kinds: this.discoveryStore.kindsOf(this.clusterId),
      namespaces: this.namespaceStore.availableOf(this.clusterId),
    })

    return CommandPaletteIndex.filter(items, this.query, this.recentKeys)
  }

  created(): void {
    this.titleId = `command-palette-${this.idService.next()}`

    this.onOpenRequested = (event) => {
      this.query = event.query
      this.cursor = 0
      this.open = true
    }

    this.eventBus.registerHandler(OpenCommandPaletteEvent, this.onOpenRequested)
  }

  beforeUnmount(): void {
    this.eventBus.unregisterHandler(OpenCommandPaletteEvent, this.onOpenRequested)
    super.beforeUnmount()
  }

  @Watch('open')
  openChanged(open: boolean): void {
    void this.handleOpenChange(open)
  }

  public close(): void {
    this.open = false
  }

  public onInput(event: Event): void {
    this.query = (event.target as HTMLInputElement).value
    this.cursor = 0
  }

  public onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        this.cursor = CommandPaletteIndex.nextCursor(this.cursor, 1, this.visible.length)
        break
      case 'ArrowUp':
        this.cursor = CommandPaletteIndex.nextCursor(this.cursor, -1, this.visible.length)
        break
      case 'Enter':
        this.chooseCursor()
        break
      default:
        return
    }

    event.preventDefault()
  }

  public choose(item: TCommandItem): void {
    this.recentKeys = CommandPaletteIndex.remember(this.recentKeys, item.key)
    this.close()

    if (item.namespace !== undefined) {
      void this.connectionStore.setNamespaces(this.clusterId, [item.namespace])
      return
    }

    if (item.clusterId) {
      this.connectionStore.activate(item.clusterId)
    }
    if (item.path) {
      void this.$router.push(item.path)
    }
  }

  protected isOpen(): boolean {
    return this.open
  }

  protected onEscape(): void {
    this.close()
  }

  private chooseCursor(): void {
    const item = this.visible[this.cursor]
    if (item) {
      this.choose(item)
    }
  }
}
</script>
