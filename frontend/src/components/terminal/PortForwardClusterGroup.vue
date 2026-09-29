<template>
  <section :aria-label="`Port forwards in ${name}`">
    <h3 class="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
      <cluster-avatar :icon="icon" size="sm" />
      <span :title="title" class="min-w-0 truncate">{{ name }}</span>
      <span class="tabular">{{ group.rows.length }}</span>
    </h3>

    <ul class="divide-y divide-border">
      <port-forward-list-row
          v-for="row in group.rows"
          :key="row.id"
          :row="row"
          @dismiss="$emit('dismiss')"
      />
    </ul>
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import ClusterAvatar from '@/components/cluster/ClusterAvatar.vue'
import PortForwardListRow from '@/components/terminal/PortForwardListRow.vue'
import type { TPortForwardGroup } from '@/components/terminal/types/TPortForwardGroup'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'
import { ClusterAppearanceStore } from '@/store/modules/clusterAppearance/ClusterAppearanceStore'

@Component({
  components: { ClusterAvatar, PortForwardListRow },
  emits: ['dismiss'],
})
export default class PortForwardClusterGroup extends VueBase {
  @Prop({ required: true })
  public readonly group: TPortForwardGroup

  constructor(
      @inject(ClusterAppearanceStore) public readonly appearanceStore: ClusterAppearanceStore,
  ) {
    super()
  }

  public get name(): string {
    return this.appearanceStore.displayNameOf(this.group.clusterId)
  }

  public get title(): string {
    return this.name === this.group.title ? this.name : `${this.name} (${this.group.title})`
  }

  public get icon(): TClusterIcon {
    return this.appearanceStore.iconOf(this.group.clusterId)
  }
}
</script>
