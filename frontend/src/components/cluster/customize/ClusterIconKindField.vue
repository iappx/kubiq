<template>
  <fieldset :aria-describedby="error ? errorId : undefined" class="space-y-1.5">
    <legend class="text-sm text-muted-foreground">Icon</legend>

    <div class="flex gap-1">
      <label
          v-for="kind in kinds"
          :key="kind"
          :class="['ui-tab cluster-choice', value === kind ? 'ui-tab-active' : '']"
      >
        <input v-model="value" :name="groupName" :value="kind" class="sr-only" type="radio">
        {{ titleOf(kind) }}
      </label>
    </div>

    <p v-if="error" :id="errorId" class="text-xs text-destructive" role="alert">{{ error }}</p>
  </fieldset>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { ClusterIconKindCatalog } from '@/domain/entities/catalog/ClusterIconKindCatalog'
import type { TClusterIconKind } from '@/domain/entities/catalog/types/TClusterIconKind'

@Component({})
export default class ClusterIconKindField extends VueBase {
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
    this.groupName = `icon-kind-${this.idService.next()}`
  }

  public get errorId(): string {
    return `${this.groupName}-error`
  }

  public get kinds(): TClusterIconKind[] {
    return ClusterIconKindCatalog.keys()
  }

  public titleOf(kind: TClusterIconKind): string {
    return ClusterIconKindCatalog.title(kind)
  }
}
</script>
