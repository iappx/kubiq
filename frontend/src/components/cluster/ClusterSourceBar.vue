<template>
  <section aria-label="Added kubeconfig files" class="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">
    <file-cog :size="14" aria-hidden="true" class="shrink-0 text-muted-foreground" />

    <span
        v-for="path in sources"
        :key="path"
        class="pill gap-1 max-w-80"
    >
      <span :title="path" class="truncate">{{ path }}</span>
      <button
          :aria-label="`Remove ${path} from the catalog`"
          :title="`Remove ${path} from the catalog`"
          class="shrink-0 text-muted-foreground hover:text-destructive"
          type="button"
          @click="$emit('remove', path)"
      >
        <x :size="10" />
      </button>
    </span>
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { FileCog, X } from '@lucide/vue'

@Component({
  components: { FileCog, X },
  emits: ['remove'],
})
export default class ClusterSourceBar extends VueBase {
  @Prop({ required: true })
  public readonly sources: string[]
}
</script>
