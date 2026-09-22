<template>
  <ui-side-panel
      :label="panelLabel"
      :open="!!project"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>{{ project?.name }}</template>
    <template #subtitle>{{ project?.description }}</template>

    <div v-if="project" class="space-y-3">
      <ui-section title="Project">
        <argo-fact-list :facts="facts" />
      </ui-section>

      <ui-section description="Where applications in this project may pull from" title="Source repositories">
        <p v-if="sourceRepos.length === 0" class="text-xs text-muted-foreground">No repository is allowed.</p>
        <ul v-else class="divide-y divide-border">
          <li v-for="repo in sourceRepos" :key="repo" :title="repo" class="truncate py-1 text-xs text-foreground">
            {{ repo }}
          </li>
        </ul>
      </ui-section>

      <ui-section description="Where applications in this project may deploy" title="Destinations">
        <p v-if="destinations.length === 0" class="text-xs text-muted-foreground">No destination is allowed.</p>
        <ul v-else class="divide-y divide-border">
          <li
              v-for="destination in destinations"
              :key="destination"
              :title="destination"
              class="truncate py-1 text-xs text-foreground"
          >{{ destination }}</li>
        </ul>
      </ui-section>
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import ArgoFactList from '@/components/argocd/detail/ArgoFactList.vue'
import type { TArgoFact } from '@/components/argocd/types/TArgoFact'
import type { ArgoAppProjectEntity } from '@/domain/entities/argocd/ArgoAppProjectEntity'

@Component({
  components: { ArgoFactList, UiSection, UiSidePanel },
  emits: ['close', 'update:width'],
})
export default class ArgoProjectDetailPanel extends VueBase {
  @Prop({ required: false, default: null })
  public readonly project: ArgoAppProjectEntity | null

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: 0 })
  public readonly applicationCount?: number

  public get panelLabel(): string {
    return this.project ? `Argo CD project ${this.project.name}` : 'Project details'
  }

  public get facts(): TArgoFact[] {
    return [
      { label: 'Applications', value: String(this.applicationCount ?? 0) },
      { label: 'Lives in', value: this.project?.namespace ?? '' },
      { label: 'Created', value: this.project?.createdAt ?? '', isAge: true },
    ]
  }

  public get sourceRepos(): string[] {
    return this.project?.sourceRepos ?? []
  }

  public get destinations(): string[] {
    return (this.project?.destinations ?? []).map(destination => [
      destination.name ?? destination.server ?? '*',
      destination.namespace ?? '*',
    ].join(' · '))
  }
}
</script>
