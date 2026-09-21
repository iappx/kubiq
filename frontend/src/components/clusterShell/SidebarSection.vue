<template>
  <section :aria-label="section.title">
    <h2 v-if="!collapsed" class="ui-sidebar-heading">{{ section.title }}</h2>
    <hr v-else class="mx-2 my-2 border-t border-sidebar-border" >

    <sidebar-link
        v-for="item in section.items"
        :key="item.key"
        :active="item.slug === activeSlug"
        :cluster-id="clusterId"
        :collapsed="collapsed"
        :item="item"
    />
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import SidebarLink from '@/components/clusterShell/SidebarLink.vue'
import type { TClusterSection } from '@/components/clusterShell/types/TClusterSection'

@Component({
  components: { SidebarLink },
})
export default class SidebarSection extends VueBase {
  @Prop({ required: true })
  public readonly section: TClusterSection

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: '' })
  public readonly activeSlug?: string

  @Prop({ required: false, default: false })
  public readonly collapsed?: boolean
}
</script>
