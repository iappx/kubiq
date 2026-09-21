<template>
  <div class="space-y-1.5">
    <label :for="fieldId" class="text-sm text-muted-foreground">{{ label }}</label>

    <slot :described-by="error ? errorId : undefined" :field-id="fieldId" />

    <p v-if="error" :id="errorId" class="text-xs text-destructive" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'

@Component({})
export default class UiFormField extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false })
  public readonly error?: string

  public fieldId = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  public get errorId(): string {
    return `${this.fieldId}-error`
  }

  created(): void {
    this.fieldId = `field-${this.idService.next()}`
  }
}
</script>
