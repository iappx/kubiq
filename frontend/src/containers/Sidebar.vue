<template>
  <aside
      :class="[
        'bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200',
        collapsed ? 'w-14' : 'w-56',
      ]"
  >
    <nav class="flex-1 py-3 px-2 space-y-1">
      <router-link
          v-for="item in menuStore.menuItems"
          :key="item.path"
          v-slot="{ href, navigate, isActive }"
          :to="item.path"
          custom
      >
        <a
            :class="['nav-link', isActive ? 'nav-link-active' : '']"
            :href="href"
            :title="collapsed ? item.title : undefined"
            @click="navigate"
        >
          <component :is="item.icon" :size="18" class="shrink-0" />
          <span v-if="!collapsed" class="overflow-hidden whitespace-nowrap">
            {{ item.title }}
          </span>
        </a>
      </router-link>
    </nav>

    <button
        :aria-label="collapsed ? 'Expand menu' : 'Collapse menu'"
        class="btn-icon m-2 self-center"
        type="button"
        @click="collapsed = !collapsed"
    >
      <chevron-left v-if="!collapsed" :size="16" />
      <chevron-right v-else :size="16" />
    </button>
  </aside>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { MenuStore } from '@/store/modules/menu/MenuStore'
import { RouteRecordRaw } from 'vue-router'
import { inject } from 'tsyringe'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

@Component({
  components: { ChevronRight, ChevronLeft },
})
export default class Sidebar extends VueBase {
  public collapsed = false

  constructor(
      @inject(MenuStore) public readonly menuStore: MenuStore,
  ) {
    super()
  }

  created(): void {
    this.menuStore.loadMenu()
    this.setSelectedMenu(this.$route)
  }

  @Watch('$route')
  routeChanged(to: RouteRecordRaw, from: RouteRecordRaw): void {
    this.setSelectedMenu(this.$route)
    if (to.path !== from.path) {
      window.scrollTo(0, 0)
    }
  }

  private setSelectedMenu(route: any): void {
    if (route.matched) {
      const openMenu = route.meta?.openedMenu ?? route.matched[route.matched.length - 1].parent?.name
      this.menuStore.setOpenedMenu(openMenu)
    }
    this.menuStore.setSelectedSidebar(route.meta?.selectedMenu ? route.meta.selectedMenu : route.name)
  }
}
</script>
