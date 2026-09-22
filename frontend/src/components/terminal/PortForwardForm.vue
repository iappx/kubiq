<template>
  <div class="border-b border-border">
    <form class="port-forward-form" @submit.prevent="submit">
      <ui-form-field v-slot="{ fieldId, describedBy }" class="w-32" label="Kind">
        <select
            :id="fieldId"
            v-model="draft.resource"
            :aria-describedby="describedBy"
            class="ui-input"
            @change="reload"
        >
          <option value="pods">Pod</option>
          <option value="services">Service</option>
        </select>
      </ui-form-field>

      <ui-suggest-field
          v-model="draft.namespace"
          :error="errors.namespace"
          :options="namespaces"
          class="w-40"
          label="Namespace"
          placeholder="default"
          @change="reload"
      />

      <ui-suggest-field
          v-model="draft.name"
          :error="errors.name"
          :options="portForwardStore.names"
          class="flex-1 min-w-40"
          label="Name"
          @change="discover"
      />

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.remotePort" class="w-28" label="Port">
        <input
            :id="fieldId"
            v-model="draft.remotePort"
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
            v-model="draft.localPort"
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
          @click="draft.remotePort = String(port.port)"
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
import UiSuggestField from '@/components/common/form/UiSuggestField.vue'
import { PortForwardValidator } from '@/application/validators/PortForwardValidator'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardTarget } from '@/application/services/portForward/types/TPortForwardTarget'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { Play, UiFormField, UiSuggestField },
})
export default class PortForwardForm extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  public draft: TPortForwardDraft = {
    resource: 'pods',
    namespace: '',
    name: '',
    remotePort: '',
    localPort: '',
  }

  public errors: Record<string, string> = {}

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
      @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
      @inject(PortForwardValidator) private readonly validator: PortForwardValidator,
  ) {
    super()
  }

  async created(): Promise<void> {
    this.applyTarget(this.portForwardStore.target)

    await this.namespaceStore.loadFor(this.clusterId)
    await this.reload()
  }

  public get busy(): boolean {
    return this.portForwardStore.starting
  }

  public get known(): TPortForwardPort[] {
    return this.portForwardStore.ports
  }

  public get namespaces(): string[] {
    return this.namespaceStore.availableOf(this.clusterId)
  }

  @Watch('portForwardStore.target')
  targetChanged(target: TPortForwardTarget | null): void {
    this.applyTarget(target)
    void this.reload()
  }

  public reload(): Promise<void> {
    return this.portForwardStore.loadNames(this.clusterId, this.draft.namespace.trim(), this.draft.resource)
  }

  public discover(): void {
    if (this.draft.namespace === '' || this.draft.name === '') {
      return
    }

    void this.portForwardStore.loadPorts(
        this.clusterId,
        this.draft.namespace.trim(),
        this.draft.resource,
        this.draft.name.trim(),
    )
  }

  public submit(): void {
    const result = this.validator.validate(this.draft)
    this.errors = result.errors

    if (!result.valid) {
      return
    }

    const parsed = PortForwardValidator.parse(this.draft)

    void this.portForwardStore.start({
      clusterId: this.clusterId,
      namespace: this.draft.namespace.trim(),
      resource: this.draft.resource,
      name: this.draft.name.trim(),
      remotePort: parsed.remotePort,
      localPort: parsed.localPort,
    })
  }

  private applyTarget(target: TPortForwardTarget | null): void {
    if (!target) {
      return
    }

    this.draft = {
      resource: target.resource,
      namespace: target.namespace,
      name: target.name,
      remotePort: target.remotePort > 0 ? String(target.remotePort) : '',
      localPort: '',
    }
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
