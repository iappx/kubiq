<template>
  <fieldset :aria-describedby="error ? errorId : undefined" class="space-y-1.5">
    <legend class="text-sm text-muted-foreground">Color</legend>

    <div class="flex flex-wrap gap-2">
      <label
          v-for="color in colors"
          :key="color"
          :class="['cluster-swatch cluster-choice', `cluster-avatar-${color}`, value === color ? 'cluster-swatch-on' : '']"
          :title="titleOf(color)"
      >
        <input v-model="value" :aria-label="titleOf(color)" :name="groupName" :value="color" class="sr-only" type="radio">
        <check v-if="value === color" :size="14" aria-hidden="true" />
      </label>
    </div>

    <p v-if="error" :id="errorId" class="text-xs text-destructive" role="alert">{{ error }}</p>
  </fieldset>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Check } from '@lucide/vue'
import { IdService } from '@/application/services/id/IdService'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import type { TClusterIconColor } from '@/domain/entities/catalog/types/TClusterIconColor'

@Component({
  components: { Check },
})
export default class ClusterIconColorField extends VueBase {
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
    this.groupName = `icon-color-${this.idService.next()}`
  }

  public get errorId(): string {
    return `${this.groupName}-error`
  }

  public get colors(): TClusterIconColor[] {
    return ClusterIconColorCatalog.keys()
  }

  public titleOf(color: TClusterIconColor): string {
    return ClusterIconColorCatalog.title(color)
  }
}
</script>
