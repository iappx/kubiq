<template>
  <section :aria-label="section.title">
    <h2 v-if="!collapsed" class="ui-sidebar-heading">{{ section.title }}</h2>
    <hr v-else class="mx-2 my-2 border-t border-sidebar-border" >

    <template v-if="grouped">
      <sidebar-sub-group
          v-for="group in section.groups"
          :key="group.key"
          :active-slug="activeSlug"
          :cluster-id="clusterId"
          :expanded="expandedKeys.includes(group.key)"
          :group="group"
          @toggle="toggle(group.key)"
      />
    </template>

    <template v-else>
      <sidebar-link
          v-for="item in section.items"
          :key="item.key"
          :active="item.slug === activeSlug"
          :cluster-id="clusterId"
          :collapsed="collapsed"
          :item="item"
      />
    </template>
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import SidebarLink from '@/components/clusterShell/SidebarLink.vue'
import SidebarSubGroup from '@/components/clusterShell/SidebarSubGroup.vue'
import { ClusterSectionBuilder } from '@/components/clusterShell/ClusterSectionBuilder'
import type { TClusterSection } from '@/components/clusterShell/types/TClusterSection'

@Component({
  components: { SidebarLink, SidebarSubGroup },
})
export default class SidebarSection extends VueBase {
  public expandedKeys: string[] = []

  @Prop({ required: true })
  public readonly section: TClusterSection

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: '' })
  public readonly activeSlug?: string

  @Prop({ required: false, default: false, type: Boolean })
  public readonly collapsed?: boolean

  public get grouped(): boolean {
    return !this.collapsed && this.section.groups.length > 0
  }

  public toggle(key: string): void {
    this.expandedKeys = this.expandedKeys.includes(key)
        ? this.expandedKeys.filter(known => known !== key)
        : [...this.expandedKeys, key]
  }

  created(): void {
    this.revealActive()
  }

  @Watch('activeSlug')
  @Watch('section')
  activeChanged(): void {
    this.revealActive()
  }

  private revealActive(): void {
    const group = ClusterSectionBuilder.groupOf(this.section, this.activeSlug ?? '')
    if (!group || this.expandedKeys.includes(group.key)) {
      return
    }

    this.expandedKeys = [...this.expandedKeys, group.key]
  }
}
</script>
