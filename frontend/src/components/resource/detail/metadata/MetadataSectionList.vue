<template>
  <div v-if="entries.length > 0" class="space-y-2">
    <div v-if="showToolbar" class="flex flex-wrap items-center gap-2">
      <ui-search-field
          v-if="showSearch"
          v-model="query"
          :placeholder="filterPlaceholder"
          class="min-w-0 flex-1"
      />

      <div
          v-if="showModeToggle"
          aria-label="Metadata layout"
          class="ml-auto inline-flex shrink-0 items-center rounded border border-border bg-muted/40 p-0.5"
          role="group"
      >
        <button
            :aria-pressed="effectiveMode === 'flat'"
            :class="modeButtonClass('flat')"
            type="button"
            @click="setMode('flat')"
        >
          Flat
        </button>
        <button
            :aria-pressed="effectiveMode === 'grouped'"
            :class="modeButtonClass('grouped')"
            type="button"
            @click="setMode('grouped')"
        >
          Grouped
        </button>
      </div>
    </div>

    <div v-if="filteredEntries.length === 0" class="flex items-baseline gap-2 text-xs text-muted-foreground">
      <span class="min-w-0 truncate">{{ emptyFilterMessage }}</span>
      <button class="shrink-0 font-medium text-primary hover:underline" type="button" @click="clearQuery">
        Clear filter
      </button>
    </div>

    <ul v-else-if="effectiveMode === 'flat'" class="space-y-1.5">
      <metadata-entry-row
          v-for="entry in filteredEntries"
          :key="entry.key"
          :can-diff-last-applied="canDiffLastApplied"
          :can-filter="canFilter"
          :entry="entry"
          :kind="kind"
          @copy="$emit('copy', $event)"
          @filter-label="$emit('filter-label', $event)"
          @open-diff="$emit('open-diff', $event)"
          @open-ref="$emit('open-ref', $event)"
          @open-url="$emit('open-url', $event)"
      />
    </ul>

    <div v-else class="space-y-2">
      <div
          v-for="group in visibleGroups"
          :key="group.id"
          class="space-y-1.5"
      >
        <button
            :aria-expanded="isGroupExpanded(group)"
            class="flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-xs hover:bg-muted/60"
            type="button"
            @click="toggleGroup(group)"
        >
          <chevron-down v-if="isGroupExpanded(group)" :size="14" aria-hidden="true" class="shrink-0 text-muted-foreground" />
          <chevron-right v-else :size="14" aria-hidden="true" class="shrink-0 text-muted-foreground" />
          <span :class="groupTitleClass(group)" class="min-w-0 truncate font-medium">{{ group.title }}</span>
          <span class="shrink-0 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs tabular text-muted-foreground">
            {{ group.entries.length }}
          </span>
        </button>

        <ul v-if="isGroupExpanded(group)" class="space-y-1.5 pl-2">
          <metadata-entry-row
              v-for="entry in group.entries"
              :key="entry.key"
              :can-diff-last-applied="canDiffLastApplied"
              :can-filter="canFilter"
              :entry="entry"
              :kind="kind"
              @copy="$emit('copy', $event)"
              @filter-label="$emit('filter-label', $event)"
              @open-diff="$emit('open-diff', $event)"
              @open-ref="$emit('open-ref', $event)"
              @open-url="$emit('open-url', $event)"
          />
        </ul>
      </div>
    </div>
  </div>

  <p v-else class="text-xs text-muted-foreground">{{ emptyLabel }}</p>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import MetadataEntryRow from '@/components/resource/detail/metadata/MetadataEntryRow.vue'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata'
import type { TMetadataEntry, TMetadataGroup, TMetadataKind } from '@/domain/models/metadata'

@Component({
  components: { ChevronDown, ChevronRight, MetadataEntryRow, UiSearchField },
  emits: ['copy', 'filter-label', 'open-ref', 'open-diff', 'open-url'],
})
export default class MetadataSectionList extends VueBase {
  @Prop({ required: true })
  public readonly entries: TMetadataEntry[]

  @Prop({ required: true })
  public readonly kind: TMetadataKind

  @Prop({ required: true })
  public readonly emptyLabel: string

  @Prop({ required: false, default: false })
  public readonly canFilter?: boolean

  @Prop({ required: false, default: false })
  public readonly canDiffLastApplied?: boolean

  public query = ''

  public userMode: 'flat' | 'grouped' | null = null

  public groupOverrides: Record<string, boolean> = {}

  public get allGroups(): TMetadataGroup[] {
    return MetadataKeyAnalyzer.group(this.entries)
  }

  public get filteredEntries(): TMetadataEntry[] {
    return MetadataKeyAnalyzer.filter(this.entries, this.query)
  }

  public get visibleGroups(): TMetadataGroup[] {
    return MetadataKeyAnalyzer.group(this.filteredEntries)
  }

  public get isSearching(): boolean {
    return this.query.trim().length > 0
  }

  public get showSearch(): boolean {
    return this.entries.length >= 6
  }

  public get showModeToggle(): boolean {
    return this.allGroups.length >= 2
  }

  public get showToolbar(): boolean {
    return this.showSearch || this.showModeToggle
  }

  public get effectiveMode(): 'flat' | 'grouped' {
    if (!this.showModeToggle) {
      return 'flat'
    }
    if (this.userMode !== null) {
      return this.userMode
    }

    return this.entries.length >= 8 ? 'grouped' : 'flat'
  }

  public get filterPlaceholder(): string {
    return this.kind === 'label' ? 'Filter labels' : 'Filter annotations'
  }

  public get emptyFilterMessage(): string {
    const noun = this.kind === 'label' ? 'labels' : 'annotations'

    return `No ${noun} match “${this.query.trim()}”`
  }

  public setMode(mode: 'flat' | 'grouped'): void {
    this.userMode = mode
  }

  public clearQuery(): void {
    this.query = ''
  }

  public isGroupExpanded(group: TMetadataGroup): boolean {
    if (this.isSearching) {
      return true
    }
    if (Object.prototype.hasOwnProperty.call(this.groupOverrides, group.id)) {
      return this.groupOverrides[group.id]
    }

    return !group.isNoisy
  }

  public toggleGroup(group: TMetadataGroup): void {
    this.groupOverrides = {
      ...this.groupOverrides,
      [group.id]: !this.isGroupExpanded(group),
    }
  }

  public modeButtonClass(mode: 'flat' | 'grouped'): string {
    const base = 'inline-flex h-7 items-center rounded px-2 text-xs font-medium transition-colors'

    return this.effectiveMode === mode
      ? `${base} bg-card text-foreground`
      : `${base} text-muted-foreground hover:text-foreground`
  }

  public groupTitleClass(group: TMetadataGroup): string {
    return group.isNoisy ? 'text-muted-foreground' : 'text-foreground'
  }
}
</script>
