<template>
  <div class="font-mono text-xs leading-5">
    <template v-if="isExpandableContainer">
      <button
          :aria-expanded="expanded"
          class="inline-flex min-h-7 max-w-full items-center gap-1 rounded px-1 text-left transition-colors hover:bg-muted"
          type="button"
          @click="toggle"
      >
        <chevron-down v-if="expanded" :size="12" class="shrink-0 text-muted-foreground" />
        <chevron-right v-else :size="12" class="shrink-0 text-muted-foreground" />
        <span v-if="hasKey" class="shrink-0 text-primary">{{ nodeKey }}</span>
        <span v-if="hasKey" class="shrink-0 text-muted-foreground">:</span>
        <span class="truncate text-muted-foreground">{{ containerSummary }}</span>
      </button>

      <div v-if="expanded" class="ml-2 border-l border-border pl-3">
        <metadata-json-tree
            v-for="child in children"
            :key="child.key"
            :depth="currentDepth + 1"
            :node-key="child.key"
            :value="child.value"
        />
      </div>
    </template>

    <div v-else class="flex min-h-6 items-baseline gap-1 px-1 py-0.5">
      <span v-if="hasKey" class="shrink-0 text-primary">{{ nodeKey }}<span class="text-muted-foreground">:</span></span>
      <span :class="primitiveClass">{{ primitiveText }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronRight } from '@lucide/vue'

@Component({
  name: 'MetadataJsonTree',
  components: { ChevronDown, ChevronRight },
})
export default class MetadataJsonTree extends VueBase {
  @Prop({ required: true })
  public readonly value: unknown

  @Prop({ required: false, default: '' })
  public readonly nodeKey?: string

  @Prop({ required: false, default: 0 })
  public readonly depth?: number

  public expanded = false

  public get currentDepth(): number {
    return this.depth ?? 0
  }

  public get hasKey(): boolean {
    return (this.nodeKey ?? '') !== ''
  }

  public get isArray(): boolean {
    return Array.isArray(this.value)
  }

  public get isPlainObject(): boolean {
    return typeof this.value === 'object' && this.value !== null && !Array.isArray(this.value)
  }

  public get children(): Array<{ key: string; value: unknown }> {
    if (this.isArray) {
      return (this.value as unknown[]).map((item, index) => ({
        key: String(index),
        value: item,
      }))
    }
    if (this.isPlainObject) {
      return Object.entries(this.value as Record<string, unknown>).map(([key, item]) => ({
        key,
        value: item,
      }))
    }

    return []
  }

  public get isExpandableContainer(): boolean {
    return (this.isArray || this.isPlainObject) && this.children.length > 0
  }

  public get containerSummary(): string {
    const count = this.children.length
    if (this.isArray) {
      return count === 1 ? '[1 item]' : `[${count} items]`
    }

    return count === 1 ? '{1 key}' : `{${count} keys}`
  }

  public get primitiveText(): string {
    if (this.isArray) {
      return '[]'
    }
    if (this.isPlainObject) {
      return '{}'
    }
    if (this.value === null) {
      return 'null'
    }
    if (this.value === undefined) {
      return 'undefined'
    }
    if (typeof this.value === 'string') {
      return JSON.stringify(this.value)
    }

    return String(this.value)
  }

  public get primitiveClass(): string {
    if (this.isArray || this.isPlainObject) {
      return 'text-muted-foreground'
    }
    if (this.value === null || this.value === undefined) {
      return 'italic text-muted-foreground'
    }
    if (typeof this.value === 'boolean') {
      return this.value ? 'text-success' : 'text-muted-foreground'
    }
    if (typeof this.value === 'number') {
      return 'tabular text-primary'
    }

    return 'break-all text-foreground'
  }

  created(): void {
    this.expanded = this.defaultExpanded()
  }

  @Watch('value')
  valueChanged(): void {
    this.expanded = this.defaultExpanded()
  }

  public toggle(): void {
    this.expanded = !this.expanded
  }

  private defaultExpanded(): boolean {
    if (this.currentDepth >= 2) {
      return false
    }
    if (this.currentDepth >= 1 && this.children.length > 25) {
      return false
    }

    return true
  }
}
</script>
