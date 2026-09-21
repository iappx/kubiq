<template>
  <div v-if="totalPages > 1" class="flex items-center justify-center gap-1">
    <button
        :disabled="disabled || current <= 1"
        class="page-btn"
        @click="go(current - 1)"
    >
      <chevron-left :size="16" />
    </button>

    <button
        v-for="p in pages"
        :key="p"
        :class="['page-btn', p === current ? 'page-btn-active' : '']"
        :disabled="disabled"
        @click="go(p)"
    >
      {{ p }}
    </button>

    <button
        :disabled="disabled || current >= totalPages"
        class="page-btn"
        @click="go(current + 1)"
    >
      <chevron-right :size="16" />
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

@Component({
  components: { ChevronLeft, ChevronRight },
})
export default class UiPagination extends VueBase {
  @Prop({ required: true })
  public readonly total: number

  @Prop({ required: true })
  public readonly limit: number

  @Prop({ required: false, default: false })
  public readonly disabled?: boolean

  @VModel({ name: 'page' })
  public current: number

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit))
  }

  get pages(): number[] {
    const windowSize = 5
    let start = Math.max(1, this.current - Math.floor(windowSize / 2))
    const end = Math.min(this.totalPages, start + windowSize - 1)
    start = Math.max(1, end - windowSize + 1)
    const result: number[] = []
    for (let i = start; i <= end; i++) {
      result.push(i)
    }
    return result
  }

  go(page: number): void {
    if (this.disabled || page < 1 || page > this.totalPages || page === this.current) {
      return
    }
    this.current = page
  }
}
</script>

<style scoped>
.page-btn {
  min-width: 2.25rem;
  height: 2.25rem;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background));
  transition: background-color 150ms ease, color 150ms ease;
}

.page-btn:hover:not(:disabled) {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn-active {
  background: hsl(var(--primary) / 0.1);
  border-color: hsl(var(--primary) / 0.3);
  color: hsl(var(--primary));
}
</style>
