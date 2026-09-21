<template>
  <ui-section
      description="Kubiq asks Prometheus for metrics per cluster. A cluster with no entry here shows no charts."
      title="Prometheus"
  >
    <ul v-if="entries.length > 0" class="space-y-2">
      <settings-prometheus-row
          v-for="entry in entries"
          :key="entry.clusterId"
          :entry="entry"
          @edit="edit"
          @remove="$emit('remove', $event)"
      />
    </ul>

    <p v-else class="text-sm text-muted-foreground">
      No cluster has a Prometheus source yet.
    </p>

    <settings-prometheus-form
        :busy="busy"
        :clusters="selectableClusters"
        :editing="editingEntry"
        @cancel="editingEntry = null"
        @submit="save"
    />
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import SettingsPrometheusForm from '@/components/settings/SettingsPrometheusForm.vue'
import SettingsPrometheusRow from '@/components/settings/SettingsPrometheusRow.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TClusterSettingsDraft } from '@/domain/entities/settings'

@Component({
  components: { SettingsPrometheusForm, SettingsPrometheusRow, UiSection },
  emits: ['save', 'remove'],
})
export default class SettingsPrometheusSection extends VueBase {
  @Prop({ required: true })
  public readonly entries: TClusterSettingsDraft[]

  @Prop({ required: true })
  public readonly clusters: string[]

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public editingEntry: TClusterSettingsDraft | null = null

  public get selectableClusters(): string[] {
    const configured = new Set(this.entries.map(entry => entry.clusterId))

    return this.clusters.filter(clusterId => !configured.has(clusterId))
  }

  public edit(entry: TClusterSettingsDraft): void {
    this.editingEntry = entry
  }

  public save(draft: TClusterSettingsDraft): void {
    this.editingEntry = null
    this.$emit('save', draft)
  }
}
</script>
