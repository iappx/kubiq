<template>
  <ui-section description="Kubiq remembers these for the next start." title="Appearance">
    <div class="grid gap-4 sm:grid-cols-2">
      <ui-form-field v-slot="{ fieldId }" label="Theme">
        <select :id="fieldId" class="ui-input" @change="changeTheme">
          <option v-for="option in themeOptions" :key="option.key" :selected="option.key === theme" :value="option.key">
            {{ option.title }}
          </option>
        </select>
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId }" label="Table density">
        <select :id="fieldId" class="ui-input" @change="changeDensity">
          <option v-for="option in densityOptions" :key="option.key" :selected="option.key === density" :value="option.key">
            {{ option.title }}
          </option>
        </select>
      </ui-form-field>
    </div>

    <ui-form-field v-slot="{ fieldId, describedBy }" label="Detail panel width">
      <div class="flex items-center gap-2">
        <input
            :id="fieldId"
            v-model.number="widthDraft"
            :aria-describedby="describedBy"
            :max="maxWidth"
            :min="minWidth"
            class="ui-input w-32 tabular"
            step="20"
            type="number"
            @blur="commitWidth"
            @keydown.enter.prevent="commitWidth"
        >
        <span class="text-xs text-muted-foreground">
          pixels, between {{ minWidth }} and {{ maxWidth }}
        </span>
      </div>
    </ui-form-field>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import { UiStateDefaults } from '@/application/services/uiState/constants/UiStateDefaults'
import { AppTheme } from '@/domain/models/theme'
import type { TAppDensity } from '@/domain/models/ui'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'

@Component({
  components: { UiFormField, UiSection },
  emits: ['update:theme', 'update:density', 'update:panel-width'],
})
export default class SettingsAppearanceSection extends VueBase {
  @Prop({ required: true })
  public readonly theme: AppTheme

  @Prop({ required: true })
  public readonly density: TAppDensity

  @Prop({ required: true })
  public readonly panelWidth: number

  public widthDraft = UiStateDefaults.panelWidth

  public get minWidth(): number {
    return UiStateDefaults.minPanelWidth
  }

  public get maxWidth(): number {
    return UiStateDefaults.maxPanelWidth
  }

  public get themeOptions(): TUiSelectOption[] {
    return [
      { key: AppTheme.Light, title: 'Light' },
      { key: AppTheme.Dark, title: 'Dark' },
    ]
  }

  public get densityOptions(): TUiSelectOption[] {
    return [
      { key: 'compact', title: 'Compact' },
      { key: 'comfortable', title: 'Comfortable' },
    ]
  }

  created(): void {
    this.widthDraft = this.panelWidth
  }

  @Watch('panelWidth')
  panelWidthChanged(width: number): void {
    this.widthDraft = width
  }

  public changeTheme(event: Event): void {
    this.$emit('update:theme', (event.target as HTMLSelectElement).value)
  }

  public changeDensity(event: Event): void {
    this.$emit('update:density', (event.target as HTMLSelectElement).value)
  }

  public commitWidth(): void {
    if (this.widthDraft !== this.panelWidth) {
      this.$emit('update:panel-width', this.widthDraft)
    }
  }
}
</script>
