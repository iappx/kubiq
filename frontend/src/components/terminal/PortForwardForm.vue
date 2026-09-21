<template>
  <div class="border-b border-border">
    <form class="port-forward-form" @submit.prevent="submit">
      <ui-form-field v-slot="{ fieldId, describedBy }" class="w-32" label="Kind">
        <select :id="fieldId" v-model="draft.resource" :aria-describedby="describedBy" class="ui-input">
          <option value="pods">Pod</option>
          <option value="services">Service</option>
        </select>
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" class="w-40" label="Namespace">
        <input :id="fieldId" v-model="draft.namespace" :aria-describedby="describedBy" class="ui-input" type="text">
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" class="flex-1 min-w-40" label="Name">
        <input
            :id="fieldId"
            v-model="draft.name"
            :aria-describedby="describedBy"
            class="ui-input"
            type="text"
            @blur="discover"
        >
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.remotePort" class="w-28" label="Port">
        <input
            :id="fieldId"
            v-model="ports.remotePort"
            :aria-describedby="describedBy"
            :aria-invalid="errors.remotePort ? 'true' : undefined"
            class="ui-input tabular"
            inputmode="numeric"
            type="text"
        >
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.localPort" class="w-32" label="Local port">
        <input
            :id="fieldId"
            v-model="ports.localPort"
            :aria-describedby="describedBy"
            :aria-invalid="errors.localPort ? 'true' : undefined"
            class="ui-input tabular"
            inputmode="numeric"
            placeholder="Any"
            type="text"
        >
      </ui-form-field>

      <button :disabled="busy" class="btn-primary h-8 px-3 text-xs shrink-0" type="submit">
        <play :size="12" />
        <span>Forward</span>
      </button>
    </form>

    <div v-if="known.length > 0" class="flex flex-wrap items-center gap-1 px-4 pb-2">
      <span class="text-xs text-muted-foreground">Ports it declares:</span>
      <button
          v-for="port in known"
          :key="`${port.port}-${port.name}`"
          class="pill"
          type="button"
          @click="ports.remotePort = String(port.port)"
      >
        {{ port.name === '' ? port.port : `${port.port} · ${port.name}` }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Play } from '@lucide/vue'
import UiFormField from '@/components/common/form/UiFormField.vue'
import { PortForwardValidator } from '@/application/validators/PortForwardValidator'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardTarget } from '@/application/services/portForward/types/TPortForwardTarget'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { Play, UiFormField },
})
export default class PortForwardForm extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  public draft: { resource: string, namespace: string, name: string } = {
    resource: 'pods',
    namespace: '',
    name: '',
  }

  public ports: TPortForwardDraft = { remotePort: '', localPort: '' }

  public errors: Record<string, string> = {}

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
      @inject(PortForwardValidator) private readonly validator: PortForwardValidator,
  ) {
    super()
  }

  created(): void {
    this.applyTarget(this.portForwardStore.target)
  }

  public get busy(): boolean {
    return this.portForwardStore.starting
  }

  public get known(): TPortForwardPort[] {
    return this.portForwardStore.ports
  }

  @Watch('portForwardStore.target')
  targetChanged(target: TPortForwardTarget | null): void {
    this.applyTarget(target)
  }

  public discover(): void {
    if (this.draft.namespace === '' || this.draft.name === '') {
      return
    }

    void this.portForwardStore.loadPorts(this.clusterId, this.draft.namespace, this.draft.resource, this.draft.name)
  }

  public submit(): void {
    const result = this.validator.validate(this.ports)
    this.errors = result.errors

    if (!result.valid) {
      return
    }

    const parsed = PortForwardValidator.parse(this.ports)

    void this.portForwardStore.start({
      clusterId: this.clusterId,
      namespace: this.draft.namespace,
      resource: this.draft.resource,
      name: this.draft.name,
      remotePort: parsed.remotePort,
      localPort: parsed.localPort,
    })
  }

  private applyTarget(target: TPortForwardTarget | null): void {
    if (!target) {
      return
    }

    this.draft = { resource: target.resource, namespace: target.namespace, name: target.name }
    this.ports = { remotePort: target.remotePort > 0 ? String(target.remotePort) : '', localPort: '' }
    this.errors = {}
  }
}
</script>

<style scoped>
.port-forward-form {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
}
</style>
