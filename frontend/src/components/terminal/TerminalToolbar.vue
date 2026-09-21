<template>
  <div class="terminal-toolbar">
    <span class="truncate text-xs text-muted-foreground">{{ title }}</span>

    <select
        v-if="choices.length > 0"
        :value="containerName"
        aria-label="Container"
        class="ui-input h-7 w-40 text-xs"
        title="Container"
        @change="$emit('select-container', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="container in choices" :key="container.name" :value="container.name">
        {{ container.isInit ? `${container.name} (init)` : container.name }}
      </option>
    </select>

    <span class="terminal-divider" />

    <ui-search-field
        :model-value="search"
        class="w-56"
        placeholder="Search this terminal"
        @update:model-value="$emit('update:search', $event)"
    />

    <button
        :disabled="search === ''"
        aria-label="Find the previous match"
        class="btn-icon w-7 h-7"
        title="Find the previous match"
        type="button"
        @click="$emit('find-previous')"
    >
      <chevron-up :size="14" />
    </button>

    <button
        :disabled="search === ''"
        aria-label="Find the next match"
        class="btn-icon w-7 h-7"
        title="Find the next match"
        type="button"
        @click="$emit('find-next')"
    >
      <chevron-down :size="14" />
    </button>

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <button
          aria-label="Restart this session"
          class="btn-icon w-7 h-7"
          title="Restart this session"
          type="button"
          @click="$emit('restart')"
      >
        <rotate-cw :size="14" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronUp, RotateCw } from '@lucide/vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import type { TTerminalContainer } from '@/domain/models/terminal'

@Component({
  components: { ChevronDown, ChevronUp, RotateCw, UiSearchField },
  emits: ['update:search', 'find-next', 'find-previous', 'restart', 'select-container'],
})
export default class TerminalToolbar extends VueBase {
  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: true })
  public readonly search: string

  @Prop({ required: false, default: () => [] })
  public readonly containers?: TTerminalContainer[]

  @Prop({ required: false, default: '' })
  public readonly containerName?: string

  public get choices(): TTerminalContainer[] {
    return this.containers ?? []
  }
}
</script>

<style scoped>
.terminal-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding-inline: 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.terminal-divider {
  width: 1px;
  height: 16px;
  background-color: hsl(var(--border));
}
</style>
