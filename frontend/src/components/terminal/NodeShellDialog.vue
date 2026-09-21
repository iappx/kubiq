<template>
  <ui-modal
      :loading="terminalStore.loadingNodes"
      :open="open"
      submit-label="Open shell"
      title="Node shell"
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        A privileged pod is created on the node and removed when the tab is closed.
      </p>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="error" label="Node">
        <select
            :id="fieldId"
            v-model="nodeName"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
            class="ui-input"
        >
          <option v-for="node in terminalStore.nodes" :key="node" :value="node">{{ node }}</option>
        </select>
      </ui-form-field>
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import { TerminalStore } from '@/store/modules/terminal/TerminalStore'

@Component({
  components: { UiFormField, UiModal },
  emits: ['confirm', 'cancel'],
})
export default class NodeShellDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly clusterId: string

  public nodeName = ''

  public error = ''

  constructor(
      @inject(TerminalStore) public readonly terminalStore: TerminalStore,
  ) {
    super()
  }

  @Watch('open')
  async openChanged(open: boolean): Promise<void> {
    if (!open) {
      return
    }

    this.error = ''
    await this.terminalStore.loadNodes(this.clusterId)
    this.nodeName = this.terminalStore.nodes[0] ?? ''
  }

  public submit(): void {
    if (this.nodeName === '') {
      this.error = 'Choose the node to open a shell on'
      return
    }

    this.$emit('confirm', this.nodeName)
  }
}
</script>
