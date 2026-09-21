<template>
  <li>
    <button
        v-if="object.kind"
        class="ui-related-link"
        type="button"
        @click="$emit('open', object)"
    >
      <kube-icon :name="object.kind.icon" :size="14" class="shrink-0 text-muted-foreground" />
      <span class="min-w-0 truncate font-medium text-foreground">{{ object.name }}</span>
      <span class="shrink-0 text-muted-foreground">{{ object.kindName }}</span>
      <chevron-right :size="14" class="ml-auto shrink-0 text-muted-foreground" />
    </button>

    <div v-else class="ui-related-link cursor-default">
      <circle-slash :size="14" class="shrink-0 text-muted-foreground" />
      <span class="min-w-0 truncate text-foreground">{{ object.name }}</span>
      <span class="shrink-0 text-muted-foreground">{{ object.kindName }} · not served here</span>
    </div>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronRight, CircleSlash } from '@lucide/vue'
import KubeIcon from '@/components/common/icon/KubeIcon.vue'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'

@Component({
  components: { ChevronRight, CircleSlash, KubeIcon },
  emits: ['open'],
})
export default class ResourceRelatedRow extends VueBase {
  @Prop({ required: true })
  public readonly object: TRelatedObject
}
</script>
