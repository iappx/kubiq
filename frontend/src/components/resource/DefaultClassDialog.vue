<template>
  <confirm-dialog
      :description="description"
      :loading="busy"
      :open="!!plan"
      :title="title"
      :confirm-label="confirmLabel"
      variant="warning"
      @cancel="$emit('cancel')"
      @confirm="$emit('confirm')"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { TDefaultClassPlan } from '@/application/services/defaultClass/types/TDefaultClassPlan'

@Component({
  components: { ConfirmDialog },
  emits: ['confirm', 'cancel'],
})
export default class DefaultClassDialog extends VueBase {
  @Prop({ required: false, default: null })
  public readonly plan: TDefaultClassPlan | null

  @Prop({ required: false, type: Boolean, default: false })
  public readonly busy?: boolean

  public get kindName(): string {
    return this.plan?.target.kind.kind ?? ''
  }

  public get name(): string {
    return this.plan?.target.name ?? ''
  }

  public get isUnset(): boolean {
    return this.plan?.isDefault === false
  }

  public get confirmLabel(): string {
    return this.isUnset ? 'Unset default' : 'Set as default'
  }

  public get title(): string {
    return this.isUnset
      ? `Unset default ${this.kindName} ${this.name}`
      : `Make ${this.kindName} ${this.name} the default`
  }

  public get description(): string {
    if (this.isUnset) {
      return `${this.name} stops being the default ${this.kindName}. `
          + 'Unless another class is marked default, objects that name no class get none from now on; '
          + 'existing ones keep the class they have.'
    }

    const cleared = this.plan?.cleared ?? []
    const clearing = cleared.length > 0
      ? `The default flag is removed from ${cleared.join(', ')} first, so ${this.name} ends up the only default ${this.kindName}. `
      : ''

    return clearing
        + `Objects that name no class pick up ${this.name} from now on; existing ones keep the class they have.`
  }
}
</script>
