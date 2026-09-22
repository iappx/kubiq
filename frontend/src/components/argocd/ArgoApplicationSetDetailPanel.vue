<template>
  <ui-side-panel
      :label="panelLabel"
      :open="!!applicationSet"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>{{ applicationSet?.name }}</template>
    <template #subtitle>{{ applicationSet?.namespace }}</template>

    <div v-if="applicationSet" class="space-y-3">
      <ui-section title="Application set">
        <argo-fact-list :facts="facts" />
      </ui-section>

      <ui-section description="What the controller has to say about this set" title="Conditions">
        <p v-if="conditions.length === 0" class="text-xs text-muted-foreground">
          The controller reports nothing about this set.
        </p>

        <ul v-else class="divide-y divide-border">
          <li v-for="condition in conditions" :key="condition.type" class="space-y-0.5 py-2">
            <div class="flex items-center gap-2">
              <ui-status-badge :label="condition.type" :tone="toneOf(condition)" />
              <span class="ml-auto text-xs text-muted-foreground">{{ condition.reason || '' }}</span>
            </div>
            <p v-if="condition.message" class="text-xs text-muted-foreground break-words">{{ condition.message }}</p>
          </li>
        </ul>
      </ui-section>
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import ArgoFactList from '@/components/argocd/detail/ArgoFactList.vue'
import type { TArgoFact } from '@/components/argocd/types/TArgoFact'
import { ArgoApplicationSetEntity } from '@/domain/entities/argocd/ArgoApplicationSetEntity'
import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { ArgoFactList, UiSection, UiSidePanel, UiStatusBadge },
  emits: ['close', 'update:width'],
})
export default class ArgoApplicationSetDetailPanel extends VueBase {
  @Prop({ required: false, default: null })
  public readonly applicationSet: ArgoApplicationSetEntity | null

  @Prop({ required: true })
  public readonly width: number

  public get panelLabel(): string {
    return this.applicationSet ? `Argo CD application set ${this.applicationSet.name}` : 'Application set details'
  }

  public get conditions(): TKubeCondition[] {
    return this.applicationSet?.conditions ?? []
  }

  public get facts(): TArgoFact[] {
    return [
      { label: 'Project', value: this.applicationSet?.project ?? '' },
      { label: 'Generators', value: this.applicationSet?.generatorsText ?? '' },
      { label: 'Strategy', value: this.applicationSet?.strategy ?? '' },
      { label: 'Created', value: this.applicationSet?.createdAt ?? '', isAge: true },
    ]
  }

  public toneOf(condition: TKubeCondition): TUiTone {
    if (condition.status !== 'True') {
      return 'unknown'
    }

    return condition.type === ArgoApplicationSetEntity.errorCondition ? 'error' : 'ok'
  }
}
</script>
