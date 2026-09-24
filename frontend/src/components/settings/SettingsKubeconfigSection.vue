<template>
  <ui-section
      description="Kubiq always reads every kubeconfig in ~/.kube and every file named by KUBECONFIG, and picks up changes to them without a restart. The files and folders below are read in addition, where they are, and are never copied."
      title="Kubeconfig files"
  >
    <template #actions>
      <button class="btn-secondary" type="button" @click="$emit('add')">
        <file-plus :size="14" aria-hidden="true" />
        Add kubeconfig
      </button>
    </template>

    <ul v-if="sources.length > 0" class="space-y-2">
      <li
          v-for="path in sources"
          :key="path"
          class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
      >
        <span :title="path" class="truncate text-sm text-foreground">{{ path }}</span>
        <button
            :aria-label="`Remove ${path} from the catalog`"
            :title="`Remove ${path} from the catalog`"
            class="btn-icon w-7 h-7 shrink-0 hover:text-destructive"
            type="button"
            @click="$emit('remove', path)"
        >
          <trash-2 :size="14" />
        </button>
      </li>
    </ul>

    <p v-else class="text-sm text-muted-foreground">
      No extra kubeconfig files or folders have been added.
    </p>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { FilePlus, Trash2 } from '@lucide/vue'
import UiSection from '@/components/common/section/UiSection.vue'

@Component({
  components: { FilePlus, Trash2, UiSection },
  emits: ['add', 'remove'],
})
export default class SettingsKubeconfigSection extends VueBase {
  @Prop({ required: true })
  public readonly sources: string[]
}
</script>
