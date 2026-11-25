<template>
  <div v-if="parsed.kind === 'plain'" class="space-y-1.5">
    <div v-if="base64Hint" class="flex items-center gap-2">
      <button
          :aria-pressed="showDecoded"
          class="btn-secondary h-7 px-2 text-xs"
          type="button"
          @click="toggleDecoded"
      >
        {{ showDecoded ? 'Show encoded' : 'Decode base64' }}
      </button>
    </div>

    <template v-if="base64Hint && showDecoded">
      <div
          v-if="base64Hint.isJson && base64Hint.parsedJson !== undefined"
          class="max-h-64 overflow-auto rounded border border-border bg-muted/30 p-2"
      >
        <metadata-json-tree :value="base64Hint.parsedJson" />
      </div>
      <pre
          v-else
          class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-2 font-mono text-xs text-foreground"
      >{{ base64Hint.decoded }}</pre>
    </template>

    <span v-else class="break-all text-xs text-muted-foreground">{{ parsed.text }}</span>
  </div>

  <span
      v-else-if="parsed.kind === 'boolean'"
      :class="[
        'inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-medium',
        parsed.value ? 'text-success' : 'text-muted-foreground',
      ]"
  >
    {{ parsed.value ? 'true' : 'false' }}
  </span>

  <span v-else-if="parsed.kind === 'timestamp'" class="inline-flex flex-wrap items-baseline gap-1 text-xs">
    <span class="font-mono text-foreground tabular">{{ formattedTimestamp }}</span>
    <span class="text-muted-foreground">(<ui-age :value="parsed.iso" />)</span>
  </span>

  <template v-else-if="parsed.kind === 'url'">
    <a
        v-if="parsed.clickable"
        :href="parsed.href"
        class="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
        rel="noopener noreferrer"
        @click.prevent="openUrl(parsed.href)"
    >
      <span>{{ parsed.href }}</span>
      <external-link :size="12" class="shrink-0" />
    </a>
    <span v-else class="break-all font-mono text-xs text-foreground">{{ parsed.href }}</span>
  </template>

  <div v-else-if="parsed.kind === 'list'" class="flex flex-wrap gap-1">
    <span
        v-for="(item, index) in parsed.items"
        :key="`${item}-${index}`"
        class="break-all rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground"
    >
      {{ item }}
    </span>
  </div>

  <div v-else-if="parsed.kind === 'kvList'" class="flex flex-wrap gap-1">
    <span
        v-for="(pair, index) in parsed.pairs"
        :key="`${pair.key}-${index}`"
        class="break-all rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
    >
      <span class="text-muted-foreground">{{ pair.key }}=</span><span class="text-foreground">{{ pair.value }}</span>
    </span>
  </div>

  <button
      v-else-if="parsed.kind === 'reference'"
      class="inline-flex h-7 max-w-full items-center gap-1 rounded border border-border bg-muted/50 px-2 font-mono text-xs text-primary transition-colors hover:border-primary/40 hover:bg-muted"
      type="button"
      @click="openReference(parsed.target)"
  >
    <span class="truncate">{{ parsed.label }}</span>
    <chevron-right :size="12" class="shrink-0" />
  </button>

  <resource-certificate-chain
      v-else-if="parsed.kind === 'certificate'"
      :chain="parsed.chain"
  />

  <metadata-structured-view
      v-else-if="parsed.kind === 'structured'"
      :fields="parsed.fields"
      @open-ref="openReference($event)"
      @open-url="openUrl($event)"
  />

  <div v-else-if="parsed.kind === 'multiline'" class="space-y-1.5">
    <div class="flex items-center gap-2 text-xs">
      <span class="pill px-1.5 py-0 font-mono uppercase">{{ syntaxLabel }}</span>
      <span class="tabular text-muted-foreground">{{ lineCountLabel }}</span>
    </div>
    <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-2 font-mono text-xs text-foreground">{{ parsed.text }}</pre>
  </div>

  <div v-else-if="parsed.kind === 'json'" class="space-y-1.5">
    <div class="flex flex-wrap items-center gap-1" role="group" aria-label="JSON display format">
      <button
          v-for="mode in modes"
          :key="mode.id"
          :aria-pressed="jsonMode === mode.id"
          :class="[
            'inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium transition-colors',
            jsonMode === mode.id
              ? 'pill-active border-primary/30'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
          ]"
          type="button"
          @click="setJsonMode(mode.id)"
      >
        {{ mode.label }}
      </button>

      <button
          v-if="parsed.isLastApplied && canDiffLastApplied"
          class="btn-secondary ml-auto h-7 px-2 text-xs"
          type="button"
          @click="openDiff"
      >
        <file-diff :size="12" />
        Diff with current
      </button>
    </div>

    <div
        v-if="jsonMode === 'tree'"
        class="max-h-80 overflow-auto rounded border border-border bg-muted/30 p-2"
    >
      <metadata-json-tree :value="parsed.value" />
    </div>

    <pre
        v-else-if="jsonMode === 'yaml'"
        class="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-2 font-mono text-xs text-foreground"
    >{{ jsonAsYaml }}</pre>

    <pre
        v-else-if="jsonMode === 'json'"
        class="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-2 font-mono text-xs text-foreground"
    >{{ jsonFormatted }}</pre>

    <pre
        v-else
        class="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-2 font-mono text-xs text-foreground"
    >{{ rawValue }}</pre>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { ChevronRight, ExternalLink, FileDiff } from '@lucide/vue'
import { stringify } from 'yaml'
import UiAge from '@/components/common/time/UiAge.vue'
import ResourceCertificateChain from '@/components/resource/detail/ResourceCertificateChain.vue'
import MetadataJsonTree from '@/components/resource/detail/metadata/MetadataJsonTree.vue'
import MetadataStructuredView from '@/components/resource/detail/metadata/MetadataStructuredView.vue'
import type {
  TMetadataBase64Hint,
  TMetadataParsedValue,
  TMetadataReferenceTarget,
} from '@/domain/models/metadata'

@Component({
  components: {
    ChevronRight,
    ExternalLink,
    FileDiff,
    MetadataJsonTree,
    MetadataStructuredView,
    ResourceCertificateChain,
    UiAge,
  },
  emits: ['open-ref', 'open-diff', 'open-url'],
})
export default class MetadataValueView extends VueBase {
  public static readonly jsonModes: ReadonlyArray<{ id: 'tree' | 'yaml' | 'json' | 'raw'; label: string }> = [
    { id: 'tree', label: 'Tree' },
    { id: 'yaml', label: 'YAML' },
    { id: 'json', label: 'JSON' },
    { id: 'raw', label: 'Raw' },
  ]

  @Prop({ required: true })
  public readonly parsed: TMetadataParsedValue

  @Prop({ required: true })
  public readonly rawValue: string

  @Prop({ required: false, default: null })
  public readonly base64Hint?: TMetadataBase64Hint | null

  @Prop({ required: false, type: Boolean, default: false })
  public readonly canDiffLastApplied?: boolean

  public showDecoded = false

  public jsonMode: 'tree' | 'yaml' | 'json' | 'raw' = 'tree'

  public get modes(): ReadonlyArray<{ id: 'tree' | 'yaml' | 'json' | 'raw'; label: string }> {
    return MetadataValueView.jsonModes
  }

  public get formattedTimestamp(): string {
    if (this.parsed.kind !== 'timestamp') {
      return ''
    }
    if (Number.isFinite(this.parsed.epochMs)) {
      return new Date(this.parsed.epochMs)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, ' UTC')
        .replace(/Z$/, ' UTC')
    }

    return this.parsed.iso
  }

  public get syntaxLabel(): string {
    if (this.parsed.kind !== 'multiline') {
      return ''
    }

    return this.parsed.syntaxHint.toUpperCase()
  }

  public get lineCountLabel(): string {
    if (this.parsed.kind !== 'multiline') {
      return ''
    }

    return this.parsed.lineCount === 1 ? '1 line' : `${this.parsed.lineCount} lines`
  }

  public get jsonAsYaml(): string {
    if (this.parsed.kind !== 'json') {
      return ''
    }

    try {
      return stringify(this.parsed.value, { indent: 2, lineWidth: 0 })
    } catch {
      return this.rawValue
    }
  }

  public get jsonFormatted(): string {
    if (this.parsed.kind !== 'json') {
      return ''
    }

    try {
      return JSON.stringify(this.parsed.value, null, 2)
    } catch {
      return this.rawValue
    }
  }

  @Watch('rawValue')
  rawValueChanged(): void {
    this.showDecoded = false
    this.jsonMode = 'tree'
  }

  public toggleDecoded(): void {
    this.showDecoded = !this.showDecoded
  }

  public setJsonMode(mode: 'tree' | 'yaml' | 'json' | 'raw'): void {
    this.jsonMode = mode
  }

  public openReference(target: TMetadataReferenceTarget): void {
    this.$emit('open-ref', target)
  }

  public openDiff(): void {
    this.$emit('open-diff')
  }

  public openUrl(url: string): void {
    this.$emit('open-url', url)
  }
}
</script>
