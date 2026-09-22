<template>
  <router-link v-slot="{ href, navigate }" :to="path" custom>
    <a
        :aria-current="active ? 'page' : undefined"
        :class="['nav-link', active ? 'nav-link-active' : '']"
        :href="href"
        :title="tooltip"
        @click="navigate"
    >
      <kube-icon :name="item.icon" :size="18" />
      <span v-if="!collapsed" class="truncate">{{ item.title }}</span>
    </a>
  </router-link>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import KubeIcon from '@/components/common/icon/KubeIcon.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import type { TClusterMenuItem } from '@/components/clusterShell/types/TClusterMenuItem'

@Component({
  components: { KubeIcon },
})
export default class SidebarLink extends VueBase {
  @Prop({ required: true })
  public readonly item: TClusterMenuItem

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: false })
  public readonly active?: boolean

  @Prop({ required: false, default: false })
  public readonly collapsed?: boolean

  public get path(): string {
    return ClusterRoutes.resource(this.clusterId, this.item.section, this.item.slug)
  }

  public get tooltip(): string {
    return this.item.group.length > 0 ? `${this.item.title} · ${this.item.group}` : this.item.title
  }
}
</script>
