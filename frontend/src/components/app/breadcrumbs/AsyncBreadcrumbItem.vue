<template>
  <span class="flex items-center gap-1.5">
      <ChevronRight v-if="index > 1" :size="14" class="text-primary/40" />
      <router-link
          v-if="isLink && !loading"
          :to="path"
          class="text-muted-foreground hover:text-foreground transition-colors"
      >
        {{ title }}
      </router-link>
      <span v-else-if="!isLink" class="text-foreground font-medium">{{ title }}</span>
      <span v-else class="text-foreground font-medium">Loading</span>
  </span>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { RouteBase } from '@/lib/router/base/RouteBase'
import { RouteRecordNormalized } from 'vue-router'
import { TBreadcrumb } from '@/lib/breadcrumbs/TBreadcrumb'
import { ChevronRight } from '@lucide/vue'

@Component({
  components: { ChevronRight },
})
export default class AsyncBreadcrumbItem extends VueBase {
  @Prop({ required: true })
  public readonly routeInstance: RouteBase

  @Prop({ required: true })
  public readonly routeRecord: RouteRecordNormalized

  @Prop({ required: false, default: true })
  public readonly isLink: boolean

  @Prop({ required: false })
  public readonly updateUuid: string

  @Prop({ required: true })
  public readonly index: number

  public loading = false

  public title = ''
  public path = ''

  public breadcrumbVariants: TBreadcrumb[] = []

  @Watch('routeRecord', { deep: true })
  @Watch('updateUuid')
  async updateData(): Promise<void> {
    try {
      this.loading = true
      this.title = await this.routeInstance.getRouteTitle(this.routeRecord, this.$route.params)
      this.breadcrumbVariants = await this.routeInstance.getBreadcrumbVariants(this.routeRecord, this.$route.params)
      if (this.breadcrumbVariants.length > 10) {
        this.breadcrumbVariants = this.breadcrumbVariants.splice(10)
      }
      this.path = this.routeRecord.path.replace(/:([a-zA-Z0-9_]+)/g, (match, paramName) => {
        const value = this.$route.params[paramName]
        if (value === undefined) {
          return ''
        }
        return encodeURIComponent(String(value))
      })
    } finally {
      this.loading = false
    }
  }

  async mounted(): Promise<void> {
    await this.updateData()
  }
}
</script>
