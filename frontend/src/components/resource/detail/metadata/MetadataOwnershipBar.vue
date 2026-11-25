<template>
  <div
      v-if="badges.length > 0"
      aria-label="Resource ownership"
      class="flex flex-wrap items-center gap-1.5"
      role="list"
  >
    <div
        v-for="(badge, index) in badges"
        :key="`${badge.provider}-${badge.label}-${index}`"
        class="max-w-full"
        role="listitem"
    >
      <button
          v-if="badge.reference"
          :title="tooltipOf(badge)"
          class="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
          type="button"
          @click="openReference(badge.reference)"
      >
        <package v-if="badge.provider === 'helm'" :size="12" class="shrink-0 text-primary" />
        <git-branch v-else-if="badge.provider === 'argocd'" :size="12" class="shrink-0 text-primary" />
        <layers v-else-if="badge.provider === 'k8s-app'" :size="12" class="shrink-0 text-muted-foreground" />
        <activity v-else :size="12" class="shrink-0 text-success" />
        <span class="shrink-0 text-muted-foreground">{{ badge.label }}</span>
        <span v-if="badge.detail" class="truncate font-mono font-medium text-foreground">{{ badge.detail }}</span>
        <chevron-right :size="12" class="shrink-0 text-muted-foreground" />
      </button>

      <span
          v-else
          :title="tooltipOf(badge)"
          class="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-xs text-foreground"
      >
        <package v-if="badge.provider === 'helm'" :size="12" class="shrink-0 text-primary" />
        <git-branch v-else-if="badge.provider === 'argocd'" :size="12" class="shrink-0 text-primary" />
        <layers v-else-if="badge.provider === 'k8s-app'" :size="12" class="shrink-0 text-muted-foreground" />
        <activity v-else :size="12" class="shrink-0 text-success" />
        <span class="shrink-0 text-muted-foreground">{{ badge.label }}</span>
        <span v-if="badge.detail" class="truncate font-mono font-medium text-foreground">{{ badge.detail }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Activity, ChevronRight, GitBranch, Layers, Package } from '@lucide/vue'
import type { TMetadataOwnershipBadge, TMetadataReferenceTarget } from '@/domain/models/metadata'

@Component({
  components: { Activity, ChevronRight, GitBranch, Layers, Package },
  emits: ['open-ref'],
})
export default class MetadataOwnershipBar extends VueBase {
  @Prop({ required: true })
  public readonly badges: TMetadataOwnershipBadge[]

  public tooltipOf(badge: TMetadataOwnershipBadge): string {
    return badge.detail ? `${badge.label}: ${badge.detail}` : badge.label
  }

  public openReference(target: TMetadataReferenceTarget): void {
    this.$emit('open-ref', target)
  }
}
</script>
