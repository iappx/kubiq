<template>
  <form class="space-y-4 rounded-md border border-border p-4" @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.clusterId" label="Cluster">
        <input
            v-if="editing"
            :id="fieldId"
            :value="draft.clusterId"
            class="ui-input"
            disabled
            type="text"
        >
        <select
            v-else
            :id="fieldId"
            v-model="draft.clusterId"
            :aria-describedby="describedBy"
            :aria-invalid="errors.clusterId ? 'true' : undefined"
            class="ui-input"
        >
          <option disabled value="">Choose a cluster</option>
          <option v-for="clusterId in clusters" :key="clusterId" :value="clusterId">{{ clusterId }}</option>
        </select>
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.prometheusSource" label="Prometheus source">
        <select
            :id="fieldId"
            v-model="draft.prometheusSource"
            :aria-describedby="describedBy"
            class="ui-input"
        >
          <option v-for="option in sourceOptions" :key="option.key" :value="option.key">{{ option.title }}</option>
        </select>
      </ui-form-field>
    </div>

    <ui-form-field
        v-if="draft.prometheusSource === 'url'"
        v-slot="{ fieldId, describedBy }"
        :error="errors.prometheusUrl"
        label="Prometheus address"
    >
      <input
          :id="fieldId"
          v-model="draft.prometheusUrl"
          :aria-describedby="describedBy"
          :aria-invalid="errors.prometheusUrl ? 'true' : undefined"
          autocomplete="off"
          class="ui-input"
          placeholder="http://prometheus.internal:9090"
          spellcheck="false"
          type="text"
      >
    </ui-form-field>

    <ui-form-field
        v-if="draft.prometheusSource === 'service'"
        v-slot="{ fieldId, describedBy }"
        :error="errors.prometheusService"
        label="In-cluster service"
    >
      <input
          :id="fieldId"
          v-model="draft.prometheusService"
          :aria-describedby="describedBy"
          :aria-invalid="errors.prometheusService ? 'true' : undefined"
          autocomplete="off"
          class="ui-input"
          placeholder="monitoring/prometheus:9090"
          spellcheck="false"
          type="text"
      >
    </ui-form-field>

    <div class="flex items-center gap-2">
      <button :disabled="busy" class="btn-primary" type="submit">
        {{ editing ? 'Save' : 'Add' }}
      </button>
      <button v-if="editing" class="btn-secondary" type="button" @click="$emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import { ClusterSettingsValidator } from '@/application/validators/ClusterSettingsValidator'
import { PrometheusSourceCatalog } from '@/domain/entities/settings'
import type { TClusterSettingsDraft, TPrometheusSource } from '@/domain/entities/settings'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'

@Component({
  components: { UiFormField },
  emits: ['submit', 'cancel'],
})
export default class SettingsPrometheusForm extends VueBase {
  @Prop({ required: true })
  public readonly clusters: string[]

  @Prop({ required: false, default: null })
  public readonly editing: TClusterSettingsDraft | null

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public draft: TClusterSettingsDraft = SettingsPrometheusForm.blank()

  public errors: Record<string, string> = {}

  constructor(
      @inject(ClusterSettingsValidator) private readonly validator: ClusterSettingsValidator,
  ) {
    super()
  }

  public get sourceOptions(): TUiSelectOption[] {
    return Object.keys(PrometheusSourceCatalog.values).map(key => ({
      key,
      title: PrometheusSourceCatalog.title(key as TPrometheusSource),
    }))
  }

  created(): void {
    this.reset()
  }

  @Watch('editing')
  editingChanged(): void {
    this.reset()
  }

  public submit(): void {
    if (this.busy) {
      return
    }

    const result = this.validator.validate(this.draft)
    this.errors = result.errors

    if (result.valid) {
      this.$emit('submit', { ...this.draft })
    }
  }

  private reset(): void {
    this.draft = this.editing ? { ...this.editing } : SettingsPrometheusForm.blank()
    this.errors = {}
  }

  private static blank(): TClusterSettingsDraft {
    return {
      clusterId: '',
      prometheusSource: PrometheusSourceCatalog.Default,
      prometheusUrl: '',
      prometheusService: '',
    }
  }
}
</script>
