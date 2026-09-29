<template>
  <div class="space-y-4">
    <cluster-icon-kind-field v-model="kind" :error="errors.iconKind" />

    <ui-form-field v-if="kind === 'initials'" v-slot="{ fieldId, describedBy }" :error="errors.initials" label="Initials">
      <input
          :id="fieldId"
          v-model="initials"
          :aria-describedby="describedBy"
          :aria-invalid="errors.initials ? 'true' : undefined"
          :maxlength="maxInitials"
          autocomplete="off"
          class="ui-input w-24 uppercase"
          spellcheck="false"
          type="text"
      >
    </ui-form-field>

    <cluster-icon-glyph-field v-if="kind === 'glyph'" v-model="glyph" :error="errors.glyph" />

    <cluster-icon-image-field
        v-if="kind === 'image'"
        :can-choose="canChooseImage"
        :error="errors.image"
        :file-name="imageName"
        @choose="$emit('choose-image')"
    />

    <cluster-icon-color-field v-if="kind !== 'image'" v-model="color" :error="errors.color" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import UiFormField from '@/components/common/form/UiFormField.vue'
import ClusterIconColorField from '@/components/cluster/customize/ClusterIconColorField.vue'
import ClusterIconGlyphField from '@/components/cluster/customize/ClusterIconGlyphField.vue'
import ClusterIconImageField from '@/components/cluster/customize/ClusterIconImageField.vue'
import ClusterIconKindField from '@/components/cluster/customize/ClusterIconKindField.vue'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterIconGlyphCatalog } from '@/domain/entities/catalog/ClusterIconGlyphCatalog'
import { ClusterIconKindCatalog } from '@/domain/entities/catalog/ClusterIconKindCatalog'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import type { TClusterIconKind } from '@/domain/entities/catalog/types/TClusterIconKind'

@Component({
  components: { ClusterIconColorField, ClusterIconGlyphField, ClusterIconImageField, ClusterIconKindField, UiFormField },
  emits: ['choose-image'],
})
export default class ClusterIconEditor extends VueBase {
  @VModel()
  public draft: TClusterAppearanceDraft

  @Prop({ required: true })
  public readonly errors: Record<string, string>

  @Prop({ required: false, default: '' })
  public readonly imageName?: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly canChooseImage?: boolean

  public get maxInitials(): number {
    return ClusterMonogram.maxLength
  }

  public get kind(): TClusterIconKind {
    return this.draft.iconKind
  }

  public set kind(value: string) {
    this.draft = { ...this.draft, iconKind: ClusterIconKindCatalog.of(value) }
  }

  public get initials(): string {
    return this.draft.initials
  }

  public set initials(value: string) {
    this.draft = { ...this.draft, initials: value }
  }

  public get glyph(): string {
    return this.draft.glyph
  }

  public set glyph(value: string) {
    this.draft = { ...this.draft, glyph: ClusterIconGlyphCatalog.of(value) }
  }

  public get color(): string {
    return this.draft.color
  }

  public set color(value: string) {
    this.draft = { ...this.draft, color: ClusterIconColorCatalog.of(value) }
  }
}
</script>
