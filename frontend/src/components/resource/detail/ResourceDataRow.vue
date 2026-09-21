<template>
  <li class="space-y-1 rounded border border-border px-3 py-2">
    <div class="flex items-baseline gap-2">
      <span class="min-w-0 flex-1 truncate text-xs font-medium text-foreground" :title="entry.key">
        {{ entry.key }}
      </span>

      <span class="shrink-0 text-xs tabular text-muted-foreground">{{ sizeLabel }}</span>

      <button
          v-if="entry.hidden && !entry.binary"
          :aria-label="toggleLabel"
          :title="toggleLabel"
          class="btn-icon h-6 w-6 shrink-0"
          type="button"
          @click="toggle"
      >
        <eye-off v-if="revealed" :size="14" />
        <eye v-else :size="14" />
      </button>
    </div>

    <p v-if="entry.binary" class="text-xs text-muted-foreground">
      Binary value — open the YAML tab to read it as it is stored.
    </p>

    <p v-else-if="!visible" class="text-xs text-muted-foreground">
      Hidden. Use the reveal button to show this value on screen.
    </p>

    <p v-else-if="!printable" class="text-xs text-muted-foreground">
      This value is not printable text.
    </p>

    <pre v-else class="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">{{ value }}</pre>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { Eye, EyeOff } from '@lucide/vue'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'

@Component({
  components: { Eye, EyeOff },
})
export default class ResourceDataRow extends VueBase {
  @Prop({ required: true })
  public readonly entry: TDetailDataEntry

  @Prop({ required: true })
  public readonly object: Record<string, unknown>

  public revealed = false

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

  public get toggleLabel(): string {
    return this.revealed ? `Hide the value of ${this.entry.key}` : `Reveal the value of ${this.entry.key}`
  }

  // Switching to another object must not carry a reveal over to a key of the same name.
  @Watch('entry')
  entryChanged(): void {
    this.revealed = false
  }

  public toggle(): void {
    this.revealed = !this.revealed
  }
}
</script>
