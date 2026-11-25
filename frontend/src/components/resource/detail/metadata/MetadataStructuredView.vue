<template>
  <dl class="space-y-1.5 text-xs">
    <div
        v-for="(field, index) in fields"
        :key="`${field.label}-${index}`"
        class="flex items-baseline gap-2"
    >
      <dt class="w-32 shrink-0 text-muted-foreground">{{ field.label }}</dt>
      <dd class="min-w-0 flex-1">
        <button
            v-if="field.reference"
            class="inline-flex h-7 max-w-full items-center gap-1 rounded border border-border bg-muted/50 px-2 text-xs text-primary transition-colors hover:border-primary/40 hover:bg-muted"
            type="button"
            @click="openReference(field.reference)"
        >
          <span :class="['truncate', field.mono ? 'font-mono' : '']">{{ field.value }}</span>
          <chevron-right :size="12" class="shrink-0" />
        </button>

        <a
            v-else-if="field.url"
            :href="field.url"
            class="inline-flex items-center gap-1 break-all text-primary hover:underline"
            rel="noopener noreferrer"
            @click.prevent="openUrl(field.url)"
        >
          <span :class="field.mono ? 'font-mono' : ''">{{ field.value }}</span>
          <external-link :size="12" class="shrink-0" />
        </a>

        <ui-status-badge
            v-else-if="field.tone"
            :label="field.value"
            :tone="field.tone"
        />

        <span
            v-else
            :class="['break-all text-foreground', field.mono ? 'font-mono' : '']"
        >
          {{ field.value || '—' }}
        </span>
      </dd>
    </div>
  </dl>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronRight, ExternalLink } from '@lucide/vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TMetadataReferenceTarget, TMetadataStructuredField } from '@/domain/models/metadata'

@Component({
  components: { ChevronRight, ExternalLink, UiStatusBadge },
  emits: ['open-ref', 'open-url'],
})
export default class MetadataStructuredView extends VueBase {
  @Prop({ required: true })
  public readonly fields: TMetadataStructuredField[]

  public openReference(target: TMetadataReferenceTarget): void {
    this.$emit('open-ref', target)
  }

  public openUrl(url: string): void {
    this.$emit('open-url', url)
  }
}
</script>
