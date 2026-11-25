<template>
  <div
      v-if="hasMore"
      class="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
  >
    <span class="truncate tabular">{{ summary }}</span>

    <button
        :disabled="loading"
        class="btn-secondary h-7 shrink-0 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        @click="$emit('load-more')"
    >
      <loader-circle v-if="loading" :size="14" class="animate-spin" />
      Load more
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle } from '@lucide/vue'

@Component({
  components: { LoaderCircle },
  emits: ['load-more'],
})
export default class ResourceLoadMoreBar extends VueBase {
  @Prop({ required: true })
  public readonly loaded: number

  @Prop({ required: false })
  public readonly total?: number

  @Prop({ required: true, type: Boolean })
  public readonly hasMore: boolean

  @Prop({ required: true, type: Boolean })
  public readonly loading: boolean

  @Prop({ required: true })
  public readonly kindTitle: string

  public get summary(): string {
    const loadedText = this.loaded.toLocaleString('en-US')
    if (this.total !== undefined && this.total > this.loaded) {
      return `Showing ${loadedText} of ${this.total.toLocaleString('en-US')} ${this.kindTitle}`
    }

    return `Showing ${loadedText} ${this.kindTitle} — more available`
  }
}
</script>
