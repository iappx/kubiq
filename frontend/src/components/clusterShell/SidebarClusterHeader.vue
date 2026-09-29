<template>
  <div
      :class="['flex shrink-0 items-center gap-2 border-b border-sidebar-border py-3', collapsed ? 'justify-center px-2' : 'px-3']"
  >
    <button
        :aria-label="`Customize ${name}`"
        :title="collapsed ? `${name} — customize` : `Customize ${name}`"
        class="cluster-avatar-button"
        type="button"
        @click="customize"
    >
      <cluster-avatar :icon="icon" size="md" />
    </button>

    <div v-if="!collapsed" class="flex min-w-0 flex-col">
      <span :title="name" class="truncate text-sm font-medium text-sidebar-foreground">{{ name }}</span>
      <span v-if="name !== clusterId" :title="clusterId" class="truncate text-xs text-muted-foreground">
        {{ clusterId }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import ClusterAvatar from '@/components/cluster/ClusterAvatar.vue'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'
import { OpenClusterCustomizeEvent } from '@/domain/events/cluster/OpenClusterCustomizeEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterAppearanceStore } from '@/store/modules/clusterAppearance/ClusterAppearanceStore'

@Component({
  components: { ClusterAvatar },
})
export default class SidebarClusterHeader extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly collapsed?: boolean

  constructor(
      @inject(ClusterAppearanceStore) public readonly appearanceStore: ClusterAppearanceStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get name(): string {
    return this.appearanceStore.displayNameOf(this.clusterId)
  }

  public get icon(): TClusterIcon {
    return this.appearanceStore.iconOf(this.clusterId)
  }

  public customize(): void {
    this.eventBus.emitEvent(new OpenClusterCustomizeEvent(this.clusterId))
  }
}
</script>
