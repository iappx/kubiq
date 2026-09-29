<template>
  <div class="flex items-center gap-4">
    <cluster-avatar :icon="icon" :label="`Icon of ${name}`" size="lg" />

    <div class="flex min-w-0 flex-col items-start gap-1">
      <span :title="name" class="max-w-full truncate text-sm font-medium text-foreground">{{ name }}</span>
      <span v-if="contextName !== name" :title="contextName" class="max-w-full truncate text-xs text-muted-foreground">
        {{ contextName }}
      </span>
      <button
          v-if="canReset"
          :disabled="busy"
          class="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          @click="$emit('reset')"
      >
        <rotate-ccw :size="12" />
        Reset to default
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { RotateCcw } from '@lucide/vue'
import ClusterAvatar from '@/components/cluster/ClusterAvatar.vue'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'

@Component({
  components: { ClusterAvatar, RotateCcw },
  emits: ['reset'],
})
export default class ClusterAppearanceHeader extends VueBase {
  @Prop({ required: true })
  public readonly icon: TClusterIcon

  @Prop({ required: true })
  public readonly name: string

  @Prop({ required: true })
  public readonly contextName: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly canReset?: boolean

  @Prop({ required: false, type: Boolean, default: false })
  public readonly busy?: boolean
}
</script>
