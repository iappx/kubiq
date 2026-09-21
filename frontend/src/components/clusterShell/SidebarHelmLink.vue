<template>
  <router-link v-slot="{ href, navigate, isExactActive }" :to="path" custom>
    <a
        :aria-current="isExactActive ? 'page' : undefined"
        :class="['nav-link', isExactActive ? 'nav-link-active' : '']"
        :href="href"
        :title="collapsed ? label : undefined"
        @click="navigate"
    >
      <package :size="18" />
      <span v-if="!collapsed" class="truncate">{{ label }}</span>
    </a>
  </router-link>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Package } from '@lucide/vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'

@Component({
  components: { Package },
})
export default class SidebarHelmLink extends VueBase {
  public readonly label: string = 'Helm'

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: false })
  public readonly collapsed?: boolean

  public get path(): string {
    return ClusterRoutes.helm(this.clusterId)
  }
}
</script>
