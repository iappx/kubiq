<template>
  <fieldset :aria-describedby="error ? errorId : undefined" class="space-y-1.5">
    <legend class="text-sm text-muted-foreground">Symbol</legend>

    <div class="grid grid-cols-8 gap-1">
      <label
          v-for="glyph in glyphs"
          :key="glyph"
          :class="['cluster-glyph-option cluster-choice', value === glyph ? 'cluster-glyph-option-on' : '']"
          :title="titleOf(glyph)"
      >
        <input v-model="value" :aria-label="titleOf(glyph)" :name="groupName" :value="glyph" class="sr-only" type="radio">
        <component :is="iconOf(glyph)" :size="16" aria-hidden="true" />
      </label>
    </div>

    <p v-if="error" :id="errorId" class="text-xs text-destructive" role="alert">{{ error }}</p>
  </fieldset>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { ClusterGlyphResolver } from '@/components/cluster/ClusterGlyphResolver'
import { ClusterIconGlyphCatalog } from '@/domain/entities/catalog/ClusterIconGlyphCatalog'
import type { TClusterIconGlyph } from '@/domain/entities/catalog/types/TClusterIconGlyph'

@Component({})
export default class ClusterIconGlyphField extends VueBase {
  @VModel()
  public value: string

  @Prop({ required: false, default: '' })
  public readonly error?: string

  public groupName = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.groupName = `icon-glyph-${this.idService.next()}`
  }

  public get errorId(): string {
    return `${this.groupName}-error`
  }

  public get glyphs(): TClusterIconGlyph[] {
    return ClusterIconGlyphCatalog.keys()
  }

  public titleOf(glyph: TClusterIconGlyph): string {
    return ClusterIconGlyphCatalog.title(glyph)
  }

  public iconOf(glyph: TClusterIconGlyph): VueComponent {
    return ClusterGlyphResolver.resolve(glyph)
  }
}
</script>
