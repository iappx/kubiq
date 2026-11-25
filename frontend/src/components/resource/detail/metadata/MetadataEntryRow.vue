<template>
  <li :class="rowClasses">
    <template v-if="isInline">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ui-tooltip v-if="entry.description" :text="entry.description">
          <span :title="entry.key" class="min-w-0 break-all font-mono text-xs">
            <span v-if="entry.keyParts.prefix" class="text-muted-foreground">{{ entry.keyParts.prefix }}/</span>
            <span class="font-medium text-foreground">{{ entry.keyParts.name }}</span>
          </span>
        </ui-tooltip>
        <span v-else :title="entry.key" class="min-w-0 break-all font-mono text-xs">
          <span v-if="entry.keyParts.prefix" class="text-muted-foreground">{{ entry.keyParts.prefix }}/</span>
          <span class="font-medium text-foreground">{{ entry.keyParts.name }}</span>
        </span>

        <div class="min-w-0 flex-1 text-xs">
          <span v-if="showRaw" class="break-all font-mono text-xs text-muted-foreground">{{ entry.rawValue }}</span>
          <metadata-value-view
              v-else
              :base64-hint="entry.base64Hint"
              :can-diff-last-applied="canDiffLastApplied"
              :parsed="entry.parsed"
              :raw-value="entry.rawValue"
              @open-diff="requestDiff"
              @open-ref="$emit('open-ref', $event)"
              @open-url="$emit('open-url', $event)"
          />
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-1">
          <button
              v-if="canToggleRaw"
              :aria-label="rawToggleAriaLabel"
              :title="rawToggleAriaLabel"
              class="inline-flex h-7 shrink-0 items-center rounded border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              type="button"
              @click="toggleRaw"
          >
            {{ rawToggleLabel }}
          </button>

          <button
              v-if="showFilter"
              :aria-label="filterAriaLabel"
              class="btn-icon h-7 w-7 shrink-0"
              title="Filter list by this label"
              type="button"
              @click="emitFilter"
          >
            <filter-icon :size="14" aria-hidden="true" />
          </button>

          <button
              :aria-label="copyAriaLabel"
              :title="copyAriaLabel"
              class="btn-icon h-7 w-7 shrink-0"
              type="button"
              @click="emitCopy"
          >
            <copy :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <button
            :aria-expanded="expanded"
            :aria-label="expandAriaLabel"
            :title="expandAriaLabel"
            class="btn-icon h-7 w-7 shrink-0"
            type="button"
            @click="toggleExpanded"
        >
          <chevron-down v-if="expanded" :size="14" aria-hidden="true" />
          <chevron-right v-else :size="14" aria-hidden="true" />
        </button>

        <div class="min-w-0 flex-1">
          <ui-tooltip v-if="entry.description" :text="entry.description">
            <span :title="entry.key" class="min-w-0 break-all font-mono text-xs">
              <span v-if="entry.keyParts.prefix" class="text-muted-foreground">{{ entry.keyParts.prefix }}/</span>
              <span class="font-medium text-foreground">{{ entry.keyParts.name }}</span>
            </span>
          </ui-tooltip>
          <span v-else :title="entry.key" class="min-w-0 break-all font-mono text-xs">
            <span v-if="entry.keyParts.prefix" class="text-muted-foreground">{{ entry.keyParts.prefix }}/</span>
            <span class="font-medium text-foreground">{{ entry.keyParts.name }}</span>
          </span>
        </div>

        <button
            v-if="!expanded"
            :aria-label="expandAriaLabel"
            :title="collapsedSummary"
            class="inline-flex h-7 max-w-full items-center truncate rounded border border-border bg-muted/40 px-2 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            type="button"
            @click="toggleExpanded"
        >
          {{ collapsedSummary }}
        </button>

        <div class="flex shrink-0 items-center gap-1">
          <button
              v-if="showCollapsedDiff"
              aria-label="Diff last-applied configuration with current object"
              class="inline-flex h-7 shrink-0 items-center rounded border border-border px-2 text-xs text-primary hover:bg-muted"
              title="Diff last-applied configuration with current object"
              type="button"
              @click="requestDiff"
          >
            Diff
          </button>

          <button
              v-if="canToggleRaw"
              :aria-label="rawToggleAriaLabel"
              :title="rawToggleAriaLabel"
              class="inline-flex h-7 shrink-0 items-center rounded border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              type="button"
              @click="toggleRaw"
          >
            {{ rawToggleLabel }}
          </button>

          <button
              v-if="showFilter"
              :aria-label="filterAriaLabel"
              class="btn-icon h-7 w-7 shrink-0"
              title="Filter list by this label"
              type="button"
              @click="emitFilter"
          >
            <filter-icon :size="14" aria-hidden="true" />
          </button>

          <button
              :aria-label="copyAriaLabel"
              :title="copyAriaLabel"
              class="btn-icon h-7 w-7 shrink-0"
              type="button"
              @click="emitCopy"
          >
            <copy :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="expanded" class="pt-1">
        <pre
            v-if="showRaw"
            class="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/30 p-2 font-mono text-xs text-muted-foreground"
        >{{ entry.rawValue }}</pre>
        <metadata-value-view
            v-else
            :base64-hint="entry.base64Hint"
            :can-diff-last-applied="canDiffLastApplied"
            :parsed="entry.parsed"
            :raw-value="entry.rawValue"
            @open-diff="requestDiff"
            @open-ref="$emit('open-ref', $event)"
            @open-url="$emit('open-url', $event)"
        />
      </div>
    </template>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronRight, Copy, Filter as FilterIcon } from '@lucide/vue'
import UiTooltip from '@/components/common/UiTooltip.vue'
import MetadataValueView from '@/components/resource/detail/metadata/MetadataValueView.vue'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata'
import type { TMetadataEntry, TMetadataKind } from '@/domain/models/metadata'

@Component({
  components: { ChevronDown, ChevronRight, Copy, FilterIcon, MetadataValueView, UiTooltip },
  emits: ['copy', 'filter-label', 'open-ref', 'open-diff', 'open-url'],
})
export default class MetadataEntryRow extends VueBase {
  @Prop({ required: true })
  public readonly entry: TMetadataEntry

  @Prop({ required: true })
  public readonly kind: TMetadataKind

  @Prop({ required: false, default: false })
  public readonly canFilter?: boolean

  @Prop({ required: false, default: false })
  public readonly canDiffLastApplied?: boolean

  public expanded = true

  public showRaw = false

  private lastKey = ''

  private lastRawValue = ''

  public get isInline(): boolean {
    if (this.entry.collapsedByDefault) {
      return false
    }

    const parsedKind = this.entry.parsed.kind
    if (parsedKind === 'boolean' || parsedKind === 'timestamp' || parsedKind === 'url' || parsedKind === 'reference') {
      return true
    }

    return parsedKind === 'plain' && this.entry.rawValue.length <= 80 && this.entry.base64Hint === null
  }

  public get rowClasses(): string {
    return this.isInline
      ? 'rounded border border-border bg-card px-2.5 py-1.5'
      : 'space-y-1 rounded border border-border bg-card px-2.5 py-2'
  }

  public get isLastApplied(): boolean {
    return this.entry.parsed.kind === 'json' && this.entry.parsed.isLastApplied
  }

  public get showCollapsedDiff(): boolean {
    return this.isLastApplied && Boolean(this.canDiffLastApplied) && !this.expanded
  }

  public get showFilter(): boolean {
    return this.kind === 'label' && Boolean(this.canFilter)
  }

  public get canToggleRaw(): boolean {
    return this.entry.parsed.kind !== 'plain' && (this.isInline || this.expanded)
  }

  public get rawToggleLabel(): string {
    return this.showRaw ? 'Parsed' : 'Raw'
  }

  public get rawToggleAriaLabel(): string {
    return this.showRaw
      ? `Show parsed view for ${this.entry.key}`
      : `Show raw value for ${this.entry.key}`
  }

  public get expandAriaLabel(): string {
    return this.expanded
      ? `Collapse ${this.entry.key}`
      : `Expand ${this.entry.key}`
  }

  public get filterAriaLabel(): string {
    return `Filter list by ${this.entry.key}=${this.entry.rawValue}`
  }

  public get copyAriaLabel(): string {
    return this.kind === 'label'
      ? `Copy label ${this.entry.key}=${this.entry.rawValue}`
      : `Copy value of ${this.entry.key}`
  }

  public get collapsedSummary(): string {
    const parsed = this.entry.parsed
    switch (parsed.kind) {
      case 'json': {
        const unit = parsed.isArray
          ? (parsed.itemCount === 1 ? 'item' : 'items')
          : (parsed.itemCount === 1 ? 'key' : 'keys')
        const prefix = parsed.isLastApplied ? 'Last applied JSON' : 'JSON'
        return `${prefix} · ${parsed.itemCount} ${unit} · ${MetadataKeyAnalyzer.formatBytes(parsed.byteSize)}`
      }
      case 'multiline': {
        const unit = parsed.lineCount === 1 ? 'line' : 'lines'
        return `${parsed.lineCount} ${unit} · ${parsed.syntaxHint.toUpperCase()} · ${MetadataKeyAnalyzer.formatBytes(parsed.byteSize)}`
      }
      case 'certificate': {
        const count = parsed.chain.certificates.length
        const unit = count === 1 ? 'cert' : 'certs'
        return `X.509 · ${count} ${unit}`
      }
      case 'structured':
        return parsed.summary ? `${parsed.badge} · ${parsed.summary}` : parsed.badge
      case 'list': {
        const count = parsed.items.length
        return `List · ${count} ${count === 1 ? 'item' : 'items'}`
      }
      case 'kvList': {
        const count = parsed.pairs.length
        return `Options · ${count} ${count === 1 ? 'pair' : 'pairs'}`
      }
      case 'boolean':
        return parsed.value ? 'true' : 'false'
      case 'timestamp':
        return parsed.iso
      case 'url':
        return parsed.href
      case 'reference':
        return `${parsed.target.kindName} · ${parsed.label}`
      case 'plain':
        return this.entry.base64Hint !== null
          ? `Base64 · ${MetadataKeyAnalyzer.formatBytes(this.entry.base64Hint.byteSize)}`
          : `${MetadataKeyAnalyzer.formatBytes(MetadataKeyAnalyzer.byteLength(this.entry.rawValue))} text`
    }
  }

  created(): void {
    this.syncEntryState(this.entry)
  }

  @Watch('entry')
  entryChanged(next: TMetadataEntry): void {
    if (next.key !== this.lastKey || next.rawValue !== this.lastRawValue) {
      this.syncEntryState(next)
    }
  }

  public toggleExpanded(): void {
    this.expanded = !this.expanded
  }

  public toggleRaw(): void {
    this.showRaw = !this.showRaw
  }

  public emitCopy(): void {
    if (this.kind === 'label') {
      const pair = `${this.entry.key}=${this.entry.rawValue}`
      this.$emit('copy', { text: pair, label: `Copied label ${pair}` })
      return
    }

    this.$emit('copy', { text: this.entry.rawValue, label: `Copied value of ${this.entry.key}` })
  }

  public emitFilter(): void {
    this.$emit('filter-label', `${this.entry.key}=${this.entry.rawValue}`)
  }

  public requestDiff(): void {
    if (this.entry.parsed.kind === 'json') {
      this.$emit('open-diff', this.entry.parsed.value)
    }
  }

  private syncEntryState(entry: TMetadataEntry): void {
    this.lastKey = entry.key
    this.lastRawValue = entry.rawValue
    this.expanded = !entry.collapsedByDefault
    this.showRaw = false
  }
}
</script>
