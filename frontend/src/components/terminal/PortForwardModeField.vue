<template>
  <fieldset :aria-describedby="error ? errorId : undefined" class="space-y-1.5">
    <legend class="text-sm text-muted-foreground">Restore</legend>

    <div class="grid gap-1">
      <label
          v-for="mode in modes"
          :key="mode"
          class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
      >
        <input
            v-model="value"
            :name="groupName"
            :value="mode"
            class="mt-0.5 shrink-0 accent-primary"
            type="radio"
        >
        <span class="flex min-w-0 flex-col">
          <span class="text-sm text-foreground">{{ titleOf(mode) }}</span>
          <span class="text-xs text-muted-foreground">{{ descriptionOf(mode) }}</span>
        </span>
      </label>
    </div>

    <p v-if="error" :id="errorId" class="text-xs text-destructive" role="alert">{{ error }}</p>
  </fieldset>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward'
import type { TPortForwardRestoreMode } from '@/domain/entities/portForward'

@Component({})
export default class PortForwardModeField extends VueBase {
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
    this.groupName = `restore-mode-${this.idService.next()}`
  }

  public get errorId(): string {
    return `${this.groupName}-error`
  }

  public get modes(): TPortForwardRestoreMode[] {
    return PortForwardRestoreModeCatalog.modes
  }

  public titleOf(mode: TPortForwardRestoreMode): string {
    return PortForwardRestoreModeCatalog.title(mode)
  }

  public descriptionOf(mode: TPortForwardRestoreMode): string {
    return PortForwardRestoreModeCatalog.description(mode)
  }
}
</script>
