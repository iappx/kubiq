<template>
  <router-link v-if="installed" v-slot="{ href, navigate, isExactActive }" :to="path" custom>
    <a
        :aria-current="isExactActive ? 'page' : undefined"
        :class="['nav-link', isExactActive ? 'nav-link-active' : '']"
        :href="href"
        :title="collapsed ? label : undefined"
        @click="navigate"
    >
      <rocket :size="18" />
      <span v-if="!collapsed" class="truncate">{{ label }}</span>
    </a>
  </router-link>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Rocket } from '@lucide/vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ArgoCapabilities } from '@/domain/models/argocd'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'

@Component({
  components: { Rocket },
})
export default class SidebarArgoLink extends VueBase {
  public readonly label: string = 'Argo CD'

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: false })
  public readonly collapsed?: boolean

  constructor(
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
  ) {
    super()
  }

  public get installed(): boolean {
    return ArgoCapabilities.isInstalled(ArgoCapabilities.of(this.discoveryStore.kindsOf(this.clusterId)))
  }

  public get path(): string {
    return ClusterRoutes.argocd(this.clusterId)
  }
}
</script>
