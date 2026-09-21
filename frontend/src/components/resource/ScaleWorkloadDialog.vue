<template>
  <ui-modal
      :loading="busy"
      :open="open"
      :title="title"
      submit-label="Scale"
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        {{ description }}
      </p>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.replicas" label="Replicas">
        <input
            :id="fieldId"
            v-model="draft.replicas"
            :aria-describedby="describedBy"
            :aria-invalid="errors.replicas ? 'true' : undefined"
            class="ui-input tabular"
            inputmode="numeric"
            min="0"
            step="1"
            type="number"
            @keydown.enter.prevent="submit"
        >
      </ui-form-field>
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import { WorkloadScaleValidator } from '@/application/validators/WorkloadScaleValidator'
import type { TWorkloadScaleDraft } from '@/application/services/workloadAction/types/TWorkloadScaleDraft'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { KubeResourceKind } from '@/domain/models/kube'

@Component({
  components: { UiFormField, UiModal },
  emits: ['confirm', 'cancel'],
})
export default class ScaleWorkloadDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly row: TResourceRow | null

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  @Prop({ required: false, default: 0 })
  public readonly current?: number

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public draft: TWorkloadScaleDraft = { replicas: '0' }

  public errors: Record<string, string> = {}

  constructor(
      @inject(WorkloadScaleValidator) private readonly validator: WorkloadScaleValidator,
  ) {
    super()
  }

  public get title(): string {
    return `Scale ${this.kind?.kind ?? 'workload'} ${this.row?.name ?? ''}`.trim()
  }

  public get description(): string {
    const scope = this.row?.namespace ? ` in ${this.row.namespace}` : ''

    return `${this.row?.name ?? 'This workload'}${scope} currently runs ${this.current} of them. `
        + 'Scaling is reversible — set the count again to undo it.'
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.reset()
    }
  }

  public submit(): void {
    const result = this.validator.validate(this.draft)
    this.errors = result.errors

    if (result.valid) {
      this.$emit('confirm', WorkloadScaleValidator.parse(this.draft))
    }
  }

  private reset(): void {
    this.draft = { replicas: String(this.current ?? 0) }
    this.errors = {}
  }
}
</script>
