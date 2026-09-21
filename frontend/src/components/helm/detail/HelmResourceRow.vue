<template>
  <li class="flex items-center gap-2 py-1">
    <kube-icon :name="icon" :size="14" class="shrink-0 text-muted-foreground" />

    <router-link
        v-if="link.path"
        :title="link.resource.name"
        :to="link.path"
        class="ui-name-button truncate"
    >{{ link.resource.name }}</router-link>
    <span v-else :title="link.resource.name" class="truncate text-foreground">{{ link.resource.name }}</span>

    <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{ link.title }}</span>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import KubeIcon from '@/components/common/icon/KubeIcon.vue'
import type { THelmResourceLink } from '@/components/helm/types/THelmResourceLink'

@Component({
  components: { KubeIcon },
})
export default class HelmResourceRow extends VueBase {
  public static readonly fallbackIcon: string = 'box'

  @Prop({ required: true })
  public readonly link: THelmResourceLink

  @Prop({ required: false, default: HelmResourceRow.fallbackIcon })
  public readonly icon?: string
}
</script>
