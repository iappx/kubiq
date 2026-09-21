<template>
  <nav class="flex items-center gap-1.5 text-sm mb-6">
    <async-breadcrumb-item
        v-for="(item, index) in breadcrumbs"
        :key="item.uuid"
        :index="index"
        :is-link="item.isLink"
        :route-instance="item.routeInstance"
        :route-record="item.routeRecord"
        :update-uuid="item.uuid"
    />
  </nav>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { MenuStore } from '@/store/modules/menu/MenuStore'
import { inject } from 'tsyringe'
import { RouteStorage } from '@/lib/router/RouteStorage'
import { RouteBase } from '@/lib/router/base/RouteBase'
import { RouteRecordNormalized } from 'vue-router'
import AsyncBreadcrumbItem from '@/components/app/breadcrumbs/AsyncBreadcrumbItem.vue'
import { Uuid } from '@/lib/uuid/Uuid'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { UpdateBreadcrumbsEvent } from '@/domain/events/app/UpdateBreadcrumbsEvent'

type TBreadcrumb = {
  routeInstance: RouteBase
  routeRecord: RouteRecordNormalized
  isLink: boolean
  uuid: string
}

@Component({
  components: { AsyncBreadcrumbItem },
})
export default class AppBreadcrumbs extends VueBase {
  public breadcrumbs: TBreadcrumb[] = []

  constructor(
      @inject(EventBus) private readonly eventBus: EventBus,
      @inject(MenuStore) private readonly menuStore: MenuStore,
  ) {
    super()
  }

  @Watch('$route', { deep: true })
  @Watch('menuStore.currentPageTitle', { deep: true })
  async routeChanged(): Promise<void> {
    this.breadcrumbs = []
    for (let i = 0; i < this.$route.matched.length; i++) {
      const matchedElement = this.$route.matched[i]
      if (!matchedElement.name) {
        continue
      }
      const route = RouteStorage.instance.getRouteByName(matchedElement.name.toString())
      if (route) {
        this.breadcrumbs.push({
          routeInstance: route.moduleInstance,
          routeRecord: matchedElement,
          isLink: i < this.$route.matched.length - 1,
          uuid: Uuid.v4(),
        })
      }
    }
  }

  created(): void {
    this.routeChanged()
    this.eventBus.registerHandler(UpdateBreadcrumbsEvent, () => {
      this.routeChanged()
    })
  }
}
</script>
