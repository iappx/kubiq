<template>
  <li class="space-y-1 rounded border border-border px-3 py-2">
    <div class="flex items-baseline gap-2">
      <span class="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground" :title="entry.key">
        {{ entry.key }}
      </span>

      <span class="shrink-0 text-xs tabular text-muted-foreground">{{ sizeLabel }}</span>

      <button
          v-if="parsedChain !== null"
          :aria-label="modeAriaLabel"
          :title="modeAriaLabel"
          class="inline-flex h-7 shrink-0 items-center rounded border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          type="button"
          @click="toggleMode"
      >
        {{ modeLabel }}
      </button>

      <button
          v-if="entry.hidden && !entry.binary && parsedChain === null"
          :aria-label="toggleLabel"
          :title="toggleLabel"
          class="btn-icon h-7 w-7 shrink-0"
          type="button"
          @click="toggle"
      >
        <eye-off v-if="revealed" :size="14" />
        <eye v-else :size="14" />
      </button>

      <button
          v-if="copyable"
          :aria-label="copyLabel"
          :title="copyLabel"
          class="btn-icon h-7 w-7 shrink-0"
          type="button"
          @click="$emit('copy', entry)"
      >
        <copy :size="14" />
      </button>

      <button
          v-if="canEdit"
          :aria-label="editLabel"
          class="btn-icon h-7 w-7 shrink-0"
          title="Edit value"
          type="button"
          @click="$emit('edit', entry)"
      >
        <pencil :size="14" />
      </button>

      <button
          v-if="canDelete"
          :aria-label="deleteLabel"
          class="btn-icon h-7 w-7 shrink-0 text-destructive"
          title="Delete key"
          type="button"
          @click="$emit('delete', entry)"
      >
        <trash2 :size="14" />
      </button>
    </div>

    <template v-if="parsedChain !== null">
      <pre v-if="showRaw" class="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{{ rawPemValue }}</pre>
      <resource-certificate-chain v-else :chain="parsedChain" />
    </template>

    <p v-else-if="entry.binary" class="text-xs text-muted-foreground">
      Binary value — open the YAML tab to read it as it is stored.
    </p>

    <p v-else-if="!visible" class="text-xs text-muted-foreground">
      Hidden. Use the reveal button to show this value on screen.
    </p>

    <p v-else-if="!printable" class="text-xs text-muted-foreground">
      This value is not printable text.
    </p>

    <pre v-else class="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{{ value }}</pre>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { Copy, Eye, EyeOff, Pencil, Trash2 } from '@lucide/vue'
import ResourceCertificateChain from '@/components/resource/detail/ResourceCertificateChain.vue'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'
import { X509CertificateParser } from '@/domain/models/certificate'
import type { TX509Chain } from '@/domain/models/certificate'

@Component({
  components: { Copy, Eye, EyeOff, Pencil, ResourceCertificateChain, Trash2 },
  emits: ['copy', 'edit', 'delete'],
})
export default class ResourceDataRow extends VueBase {
  @Prop({ required: true })
  public readonly entry: TDetailDataEntry

  @Prop({ required: true })
  public readonly object: Record<string, unknown>

  @Prop({ required: false, type: Boolean, default: false })
  public readonly editable?: boolean

  @Prop({ required: false, type: Boolean, default: false })
  public readonly deletable?: boolean

  public revealed = false

  public showRaw = false

  public get parsedChain(): TX509Chain | null {
    if (this.entry.binary) {
      return null
    }

    const raw = DetailDataEntries.valueOf(this.object, this.entry)
    if (!X509CertificateParser.hasPemCertificate(raw)) {
      return null
    }

    return X509CertificateParser.parsePublicPem(raw)
  }

  public get rawPemValue(): string {
    return this.parsedChain !== null ? DetailDataEntries.valueOf(this.object, this.entry) : ''
  }

  public get visible(): boolean {
    return !this.entry.hidden || this.revealed
  }

  public get value(): string {
    return this.visible ? DetailDataEntries.valueOf(this.object, this.entry) : ''
  }

  public get printable(): boolean {
    return this.visible && DetailDataEntries.isPrintable(this.object, this.entry)
  }

  public get sizeLabel(): string {
    return `${this.entry.size} B`
  }

  public get copyable(): boolean {
    return DetailDataEntries.isCopyable(this.object, this.entry)
  }

  public get canEdit(): boolean {
    return Boolean(this.editable)
      && !this.entry.binary
      && this.entry.field === DetailDataEntries.dataField
      && DetailDataEntries.isCopyable(this.object, this.entry)
      && this.hasValidUtf8Encoding
  }

  public get canDelete(): boolean {
    return Boolean(this.deletable)
  }

  private get hasValidUtf8Encoding(): boolean {
    if (!this.entry.encoded) {
      return true
    }

    const map = this.object[this.entry.field]
    if (typeof map !== 'object' || map === null) {
      return true
    }

    const encoded = (map as Record<string, unknown>)[this.entry.key]
    if (typeof encoded !== 'string' || encoded === '') {
      return true
    }

    try {
      const binary = atob(encoded)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      new TextDecoder('utf-8', { fatal: true }).decode(bytes)

      return true
    } catch {
      return false
    }
  }

  public get editLabel(): string {
    return `Edit ${this.entry.key}`
  }

  public get deleteLabel(): string {
    return `Delete ${this.entry.key}`
  }

  public get copyLabel(): string {
    return this.entry.hidden
      ? `Copy the decoded value of ${this.entry.key} to the clipboard`
      : `Copy the value of ${this.entry.key} to the clipboard`
  }

  public get toggleLabel(): string {
    return this.revealed ? `Hide the value of ${this.entry.key}` : `Reveal the value of ${this.entry.key}`
  }

  public get modeLabel(): string {
    return this.showRaw ? 'Parsed' : 'Raw PEM'
  }

  public get modeAriaLabel(): string {
    return this.showRaw
      ? `Show parsed certificate details for ${this.entry.key}`
      : `Show raw PEM text for ${this.entry.key}`
  }

  // Switching to another object must not carry a reveal over to a key of the same name.
  @Watch('entry')
  entryChanged(): void {
    this.revealed = false
    this.showRaw = false
  }

  public toggle(): void {
    this.revealed = !this.revealed
  }

  public toggleMode(): void {
    this.showRaw = !this.showRaw
  }
}
</script>
