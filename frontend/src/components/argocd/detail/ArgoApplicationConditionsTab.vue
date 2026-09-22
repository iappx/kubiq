<template>
  <ui-section description="What the application controller has to say about this application" title="Conditions">
    <p v-if="conditions.length === 0" class="text-xs text-muted-foreground">
      The controller reports nothing about this application.
    </p>

    <ul v-else class="divide-y divide-border">
      <li v-for="condition in conditions" :key="condition.type" class="space-y-0.5 py-2">
        <div class="flex items-center gap-2">
          <ui-status-badge :label="condition.type || 'Unknown'" :tone="toneOf(condition)" />
          <ui-age v-if="condition.lastTransitionTime" :value="condition.lastTransitionTime" class="ml-auto text-xs text-muted-foreground" />
        </div>
        <p v-if="condition.message" class="text-xs text-muted-foreground break-words">{{ condition.message }}</p>
      </li>
    </ul>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiAge from '@/components/common/time/UiAge.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TArgoApplicationCondition } from '@/domain/entities/argocd/types/TArgoApplicationCondition'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { UiAge, UiSection, UiStatusBadge },
})
export default class ArgoApplicationConditionsTab extends VueBase {
  public static readonly errorMarker: string = 'Error'

  public static readonly warningMarker: string = 'Warning'

  @Prop({ required: true })
  public readonly conditions: TArgoApplicationCondition[]

  // Argo CD encodes severity in the condition type itself — `ComparisonError`, `SyncError`,
  // `OrphanedResourceWarning` — and offers no status field to read it from.
  public toneOf(condition: TArgoApplicationCondition): TUiTone {
    const type = condition.type ?? ''

    if (type.includes(ArgoApplicationConditionsTab.errorMarker)) {
      return 'error'
    }

    return type.includes(ArgoApplicationConditionsTab.warningMarker) ? 'warning' : 'info'
  }
}
</script>
