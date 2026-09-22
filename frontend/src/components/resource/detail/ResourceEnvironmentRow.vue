<template>
  <li class="space-y-1 rounded border border-border px-3 py-2">
    <div class="flex items-baseline gap-2">
      <span :title="title" class="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
        {{ title }}
      </span>

      <span v-if="provenance" :title="provenance" class="min-w-0 shrink truncate text-xs text-muted-foreground">
        {{ provenance }}
      </span>

      <button
          v-if="entry.masked"
          :aria-label="revealLabel"
          :title="revealLabel"
          class="btn-icon h-6 w-6 shrink-0"
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
          class="btn-icon h-6 w-6 shrink-0"
          type="button"
          @click="$emit('copy', entry.id)"
      >
        <copy :size="14" />
      </button>
    </div>

    <p v-if="entry.state === 'forbidden'" class="text-xs text-muted-foreground">
      You cannot read this reference, so what it sets is not shown.
    </p>

    <p v-else-if="entry.state === 'unresolved'" class="text-xs text-muted-foreground">
      This reference is not in the cluster, so nothing was read from it.
    </p>

    <pre v-else-if="hidden" class="font-mono text-xs tracking-widest text-muted-foreground">{{ mask }}</pre>

    <p v-else-if="entry.value === ''" class="text-xs text-muted-foreground">Set to an empty value.</p>

    <pre v-else class="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{{ entry.value }}</pre>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { Copy, Eye, EyeOff } from '@lucide/vue'
import type { TPodEnvironmentEntry } from '@/application/services/podEnvironment/types/TPodEnvironmentEntry'

@Component({
  components: { Copy, Eye, EyeOff },
  emits: ['copy'],
})
export default class ResourceEnvironmentRow extends VueBase {
  // Fixed width on purpose: a mask as long as the value tells the reader how long the secret is.
  public static readonly maskText: string = '••••••••••••'

  @Prop({ required: true })
  public readonly entry: TPodEnvironmentEntry

  public revealed = false

  public get title(): string {
    return this.entry.variable === '' ? this.entry.provenance : this.entry.variable
  }

  public get provenance(): string {
    return this.entry.variable === '' ? '' : this.entry.provenance
  }

  public get hidden(): boolean {
    return this.entry.masked && !this.revealed
  }

  public get mask(): string {
    return ResourceEnvironmentRow.maskText
  }

  public get copyable(): boolean {
    return this.entry.variable !== '' && this.entry.state !== 'unresolved' && this.entry.state !== 'forbidden'
  }

  public get copyLabel(): string {
    if (this.entry.masked) {
      return `Copy the secret value of ${this.entry.variable} to the clipboard`
    }
    if (this.entry.state === 'path') {
      return `Copy the field path of ${this.entry.variable} to the clipboard`
    }

    return `Copy the value of ${this.entry.variable} to the clipboard`
  }

  public get revealLabel(): string {
    return this.revealed
      ? `Hide the value of ${this.entry.variable}`
      : `Reveal the value of ${this.entry.variable}`
  }

  // Switching to another object must not carry a reveal over to a variable of the same name.
  @Watch('entry')
  entryChanged(): void {
    this.revealed = false
  }

  public toggle(): void {
    this.revealed = !this.revealed
  }
}
</script>
