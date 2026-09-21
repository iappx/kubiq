<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex shrink-0 items-center gap-2">
      <button
          v-for="mode in modes"
          :key="mode.key"
          :aria-pressed="source === mode.key"
          :class="['pill', source === mode.key ? 'pill-active' : '']"
          type="button"
          @click="source = mode.key"
      >{{ mode.label }}</button>

      <p class="ml-auto text-xs text-muted-foreground">{{ hint }}</p>
    </div>

    <p v-if="isEmpty" class="text-xs text-muted-foreground">{{ emptyText }}</p>

    <monaco-editor
        v-else
        :key="source"
        :label="editorLabel"
        :path="modelPath"
        :value="text"
        class="min-h-64"
        readonly
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import type { THelmReleaseDetail } from '@/store/modules/helm/types/THelmReleaseDetail'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'

@Component({
  components: { MonacoEditor },
})
export default class HelmReleaseValuesTab extends VueBase {
  public static readonly suppliedKey: string = 'supplied'

  public static readonly computedKey: string = 'computed'

  @Prop({ required: true })
  public readonly detail: THelmReleaseDetail

  public source: string = HelmReleaseValuesTab.suppliedKey

  public get modes(): TTab[] {
    return [
      { key: HelmReleaseValuesTab.suppliedKey, label: 'Supplied' },
      { key: HelmReleaseValuesTab.computedKey, label: 'Computed' },
    ]
  }

  public get hint(): string {
    return this.source === HelmReleaseValuesTab.suppliedKey
        ? 'The values this release was installed or upgraded with'
        : 'The chart defaults with the supplied values merged in'
  }

  public get text(): string {
    return this.source === HelmReleaseValuesTab.suppliedKey
        ? this.detail.values
        : this.detail.computedValues
  }

  public get isEmpty(): boolean {
    return this.text.trim() === '' || this.text.trim() === 'null'
  }

  public get emptyText(): string {
    return this.source === HelmReleaseValuesTab.suppliedKey
        ? 'This release was installed with the chart defaults — no values of its own.'
        : 'The chart declares no values.'
  }

  public get editorLabel(): string {
    return `${this.source === HelmReleaseValuesTab.suppliedKey ? 'Supplied' : 'Computed'} values of ${this.detail.name}`
  }

  public get modelPath(): string {
    return `inmemory://kubiq/helm/${encodeURIComponent(this.detail.namespace)}/${encodeURIComponent(this.detail.name)}/${this.source}-values.yaml`
  }
}
</script>
