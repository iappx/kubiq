<template>
  <li class="px-3 py-2 text-xs">
    <div class="flex items-center gap-2">
      <ui-status-dot :size="8" :tone="row.tone" />

      <router-link
          v-if="row.path"
          :class="targetClass"
          :title="`Show ${row.target} in ${row.clusterId}`"
          :to="row.path"
          class="min-w-0 flex-1 truncate rounded-sm font-medium hover:underline"
          @click="$emit('dismiss')"
      >
        {{ row.target }}
      </router-link>
      <span v-else :class="targetClass" :title="row.target" class="min-w-0 flex-1 truncate font-medium">
        {{ row.target }}
      </span>

      <div class="flex shrink-0 items-center gap-1">
        <button
            :aria-label="`Open ${row.address} in the browser`"
            :disabled="!row.canOpen"
            class="btn-icon w-7 h-7 disabled:opacity-50"
            title="Open in the browser"
            type="button"
            @click="open"
        >
          <external-link :size="14" />
        </button>

        <button
            :aria-label="`Copy ${row.address || 'the address'} to the clipboard`"
            :disabled="!row.canCopy"
            class="btn-icon w-7 h-7 disabled:opacity-50"
            title="Copy the address"
            type="button"
            @click="copy"
        >
          <copy :size="14" />
        </button>

        <button
            :aria-label="`Edit the forward to ${row.target}`"
            class="btn-icon w-7 h-7"
            title="Edit"
            type="button"
            @click="edit"
        >
          <pencil :size="14" />
        </button>

        <button
            :aria-label="`${toggleTitle} the forward to ${row.target}`"
            :title="toggleTitle"
            class="btn-icon w-7 h-7"
            type="button"
            @click="toggle"
        >
          <square v-if="row.canStop" :size="14" />
          <play v-else :size="14" />
        </button>

        <button
            :aria-label="`Delete the forward to ${row.target}`"
            class="btn-icon w-7 h-7 ml-2 text-destructive"
            title="Delete"
            type="button"
            @click="remove"
        >
          <trash2 :size="14" />
        </button>
      </div>
    </div>

    <p class="flex min-w-0 items-center gap-2 pl-4 text-muted-foreground">
      <span class="truncate tabular">→ {{ row.address || 'any free port' }}</span>
      <span aria-hidden="true">·</span>
      <span :class="statusClass" class="shrink-0">{{ row.statusTitle }}</span>
      <span aria-hidden="true">·</span>
      <span :title="row.modeHint" class="shrink-0">{{ row.modeTitle }}</span>
    </p>

    <p v-if="row.error" :class="statusClass" class="mt-1 pl-4 break-words">{{ row.error }}</p>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Copy, ExternalLink, Pencil, Play, Square, Trash2 } from '@lucide/vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TPortForwardRow } from '@/components/terminal/types/TPortForwardRow'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { Copy, ExternalLink, Pencil, Play, Square, Trash2, UiStatusDot },
  emits: ['dismiss'],
})
export default class PortForwardListRow extends VueBase {
  @Prop({ required: true })
  public readonly row: TPortForwardRow

  constructor(
      @inject(PortForwardStore) private readonly portForwardStore: PortForwardStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get toggleTitle(): string {
    return this.row.canStop ? 'Stop' : 'Start'
  }

  public get targetClass(): string {
    return this.row.isListening ? 'text-foreground' : 'text-muted-foreground'
  }

  public get statusClass(): string {
    if (this.row.tone === 'error') {
      return 'text-destructive'
    }

    return this.row.tone === 'warning' ? 'text-warning' : ''
  }

  public open(): void {
    void this.portForwardStore.open(this.row.id)
  }

  public copy(): void {
    void this.portForwardStore.copyAddress(this.row.id)
  }

  public toggle(): void {
    void (this.row.canStop
        ? this.portForwardStore.stop(this.row.id)
        : this.portForwardStore.start(this.row.id))
  }

  public remove(): void {
    void this.portForwardStore.remove(this.row.id)
  }

  // The popover hands focus back to its chip as it closes, and the modal must record the chip, not a vanished row.
  public async edit(): Promise<void> {
    const { clusterId, id } = this.row
    this.$emit('dismiss')
    await this.$nextTick()
    this.eventBus.emitEvent(OpenPortForwardEvent.edit(clusterId, id))
  }
}
</script>
