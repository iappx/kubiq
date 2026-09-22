<template>
  <div v-if="present.length > 0" class="flex items-center gap-1">
    <span class="text-xs text-muted-foreground shrink-0">{{ label }}</span>

    <button
        v-for="option in present"
        :key="option.key"
        :aria-label="`${label} ${option.label}, ${option.count}`"
        :aria-pressed="active === option.key"
        :class="['pill gap-1.5', active === option.key ? 'pill-active' : '']"
        type="button"
        @click="toggle(option.key)"
    >
      <ui-status-dot :size="8" :tone="option.tone" />
      {{ option.label }}
      <span class="tabular text-muted-foreground">{{ option.count }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TArgoStatusOption } from '@/components/argocd/types/TArgoStatusOption'

@Component({
  components: { UiStatusDot },
  emits: ['change'],
})
export default class ArgoStatusFilter extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly options: TArgoStatusOption[]

  @Prop({ required: false, default: '' })
  public readonly active?: string

  public get present(): TArgoStatusOption[] {
    return this.options.filter(option => option.count > 0 || option.key === this.active)
  }

  public toggle(key: string): void {
    this.$emit('change', this.active === key ? '' : key)
  }
}
</script>
