<template>
  <div>
    <h3>
      <button
          :aria-controls="regionId"
          :aria-expanded="expanded"
          class="flex w-full min-h-7 items-center gap-2 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          type="button"
          @click="$emit('toggle')"
      >
        <chevron-right :class="['shrink-0 transition-transform', expanded ? 'rotate-90' : '']" :size="14" />
        <span class="truncate">{{ group.title }}</span>
        <span class="ml-auto shrink-0 tabular">{{ group.items.length }}</span>
      </button>
    </h3>

    <div v-show="expanded" :id="regionId" :aria-label="group.title" class="pl-2" role="group">
      <sidebar-link
          v-for="item in group.items"
          :key="item.key"
          :active="item.slug === activeSlug"
          :cluster-id="clusterId"
          :item="item"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { ChevronRight } from '@lucide/vue'
import SidebarLink from '@/components/clusterShell/SidebarLink.vue'
import type { TClusterSubGroup } from '@/components/clusterShell/types/TClusterSubGroup'
import { IdService } from '@/application/services/id/IdService'

@Component({
  components: { ChevronRight, SidebarLink },
  emits: ['toggle'],
})
export default class SidebarSubGroup extends VueBase {
  public regionId = ''

  @Prop({ required: true })
  public readonly group: TClusterSubGroup

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: '' })
  public readonly activeSlug?: string

  @Prop({ required: false, default: false, type: Boolean })
  public readonly expanded?: boolean

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.regionId = `sidebar-subgroup-${this.idService.next()}`
  }
}
</script>
