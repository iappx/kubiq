<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-2 min-w-0">
      <button
          :aria-describedby="error ? errorId : undefined"
          :disabled="!canChoose"
          class="btn-secondary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          @click="$emit('choose')"
      >
        <image-plus :size="14" />
        {{ fileName ? 'Replace image' : 'Choose image' }}
      </button>
      <span :title="fileName" class="truncate text-xs text-muted-foreground">
        {{ fileName || 'No image chosen' }}
      </span>
    </div>

    <p class="text-xs text-muted-foreground">
      {{ canChoose ? hint : 'Choosing a file needs the desktop app.' }}
    </p>

    <p v-if="error" :id="errorId" class="text-xs text-destructive" role="alert">{{ error }}</p>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { ImagePlus } from '@lucide/vue'
import { IdService } from '@/application/services/id/IdService'

@Component({
  components: { ImagePlus },
  emits: ['choose'],
})
export default class ClusterIconImageField extends VueBase {
  @Prop({ required: false, default: '' })
  public readonly fileName?: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly canChoose?: boolean

  @Prop({ required: false, default: '' })
  public readonly error?: string

  public errorId = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.errorId = `icon-image-${this.idService.next()}-error`
  }

  public get hint(): string {
    return 'PNG, JPG or SVG up to 1 MB. Kubiq keeps its own copy, so the original can be moved or deleted.'
  }
}
</script>
