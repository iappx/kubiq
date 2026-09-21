<template>
  <aside
      :class="['ui-sidebar', collapsed ? 'w-14' : 'w-56']"
      aria-label="Resource sections"
  >
    <nav class="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-3">
      <sidebar-overview-link :cluster-id="clusterId" :collapsed="collapsed" />
      <sidebar-helm-link :cluster-id="clusterId" :collapsed="collapsed" />

      <ui-deferred-loader :loading="loading">
        <template #loading>
          <div aria-hidden="true" class="space-y-2 px-1">
            <span v-for="i in 8" :key="i" class="block h-4 rounded shimmer" />
          </div>
        </template>

        <div class="space-y-3">
          <sidebar-section
              v-for="section in sections"
              :key="section.key"
              :active-slug="activeSlug"
              :cluster-id="clusterId"
              :collapsed="collapsed"
              :section="section"
          />

          <p v-if="!loading && sections.length === 0 && !collapsed" class="px-2 text-xs text-muted-foreground">
            {{ emptyMessage }}
          </p>
        </div>
      </ui-deferred-loader>
    </nav>

    <button
        :aria-label="toggleLabel"
        :title="toggleLabel"
        class="btn-icon m-2 self-center shrink-0"
        type="button"
        @click="uiStore.toggleSidebar()"
    >
      <chevron-left v-if="!collapsed" :size="16" />
      <chevron-right v-else :size="16" />
    </button>
  </aside>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import SidebarHelmLink from '@/components/clusterShell/SidebarHelmLink.vue'
import SidebarOverviewLink from '@/components/clusterShell/SidebarOverviewLink.vue'
import SidebarSection from '@/components/clusterShell/SidebarSection.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import type { TClusterSection } from '@/components/clusterShell/types/TClusterSection'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'

@Component({
  components: { ChevronLeft, ChevronRight, SidebarHelmLink, SidebarOverviewLink, SidebarSection, UiDeferredLoader },
})
export default class Sidebar extends VueBase {
  @Prop({ required: true })
  public readonly sections: TClusterSection[]

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: '' })
  public readonly activeSlug?: string

  @Prop({ required: false, default: false })
  public readonly loading?: boolean

  @Prop({ required: false, default: '' })
  public readonly failure?: string

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
  ) {
    super()
  }

  public get collapsed(): boolean {
    return this.uiStore.sidebarCollapsed
  }

  public get toggleLabel(): string {
    return this.collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'
  }

  public get emptyMessage(): string {
    return this.failure
        ? this.failure
        : 'This cluster serves no resource kinds you are allowed to list.'
  }
}
</script>
