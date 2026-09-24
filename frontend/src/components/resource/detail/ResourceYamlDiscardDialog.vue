<template>
  <confirm-dialog
      :open="open"
      cancel-label="Keep editing"
      confirm-label="Discard"
      description="Your edits to this manifest have not been applied. Leaving the editor now throws them away."
      title="Discard changes?"
      variant="danger"
      @cancel="$emit('cancel')"
      @confirm="$emit('confirm')"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

@Component({
  components: { ConfirmDialog },
  emits: ['confirm', 'cancel'],
})
export default class ResourceYamlDiscardDialog extends VueBase {
  @Prop({ required: true, type: Boolean })
  public readonly open: boolean
}
</script>
