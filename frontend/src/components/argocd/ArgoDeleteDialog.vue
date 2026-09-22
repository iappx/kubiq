<template>
  <ui-modal
      :loading="busy"
      :open="open"
      :submit-label="submitLabel"
      title="Delete this application?"
      @close="$emit('cancel')"
      @submit="$emit('confirm', cascade)"
  >
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">{{ description }}</p>

      <ui-toggle
          v-model="cascade"
          description="Everything Argo CD deployed from this application is deleted with it. Without it, the objects stay in the cluster and stop being managed."
          label="Delete the resources it deployed"
      />
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import UiModal from '@/components/common/modal/UiModal.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'

@Component({
  components: { UiModal, UiToggle },
  emits: ['confirm', 'cancel'],
})
export default class ArgoDeleteDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly row: TArgoApplicationRow | null

  @Prop({ required: false, default: false })
  public readonly cascadeByDefault?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public cascade = false

  public get description(): string {
    const row = this.row

    return row
        ? `Application "${row.name}" in ${row.namespace} is removed from Argo CD. This cannot be undone.`
        : ''
  }

  public get submitLabel(): string {
    return this.cascade ? 'Delete with its resources' : 'Delete the application only'
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.cascade = this.cascadeByDefault === true
    }
  }
}
</script>
