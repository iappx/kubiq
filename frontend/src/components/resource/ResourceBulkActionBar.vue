<template>
  <div
      v-if="count > 0"
      class="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-4 py-2"
  >
    <span class="pill pill-active tabular">{{ countLabel }}</span>

    <button
        v-for="action in safeActions"
        :key="action.key"
        :disabled="busy"
        class="btn-secondary h-7 shrink-0 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        @click="trigger(action.key)"
    >
      <component :is="action.icon" :size="14" />
      {{ action.label }}
    </button>

    <button
        :disabled="busy"
        class="btn-ghost h-7 shrink-0 px-2 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        @click="$emit('clear')"
    >
      <x :size="14" />
      Clear
    </button>

    <button
        v-if="deleteAction"
        :disabled="busy"
        class="btn-danger ml-auto h-7 shrink-0 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        @click="$emit('delete')"
    >
      <loader-circle v-if="busy" :size="14" class="animate-spin" />
      <component :is="deleteAction.icon" v-else :size="14" />
      {{ deleteAction.label }}
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle, X } from '@lucide/vue'
import { ResourceBulkActions } from '@/components/resource/ResourceBulkActions'
import type { TBulkAction } from '@/components/resource/types/TBulkAction'
import type { KubeResourceKind } from '@/domain/models/kube'

@Component({
  components: { LoaderCircle, X },
  emits: ['restart', 'cordon', 'uncordon', 'delete', 'clear'],
})
export default class ResourceBulkActionBar extends VueBase {
  @Prop({ required: true })
  public readonly count: number

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get countLabel(): string {
    return `${this.count.toLocaleString('en-US')} selected`
  }

  public get available(): TBulkAction[] {
    return ResourceBulkActions.availableFor(this.kind)
  }

  public get safeActions(): TBulkAction[] {
    return this.available.filter(action => !action.danger)
  }

  public get deleteAction(): TBulkAction | undefined {
    return this.available.find(action => action.danger)
  }

  public trigger(key: string): void {
    if (key === ResourceBulkActions.restartKey) {
      this.$emit('restart')
      return
    }
    if (key === ResourceBulkActions.cordonKey) {
      this.$emit('cordon')
      return
    }
    if (key === ResourceBulkActions.uncordonKey) {
      this.$emit('uncordon')
      return
    }
    if (key === ResourceBulkActions.deleteKey) {
      this.$emit('delete')
    }
  }
}
</script>
