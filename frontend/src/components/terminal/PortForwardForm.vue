<template>
  <ui-modal
      :loading="busy"
      :open="open"
      :submit-label="submitLabel"
      :title="title"
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="space-y-4">
      <port-forward-target-summary
          v-if="targetLocked"
          :cluster-id="clusterId"
          :name="draft.name"
          :namespace="draft.namespace"
          :resource="draft.resource"
      />

      <div v-else class="grid grid-cols-2 gap-3">
        <p class="col-span-2 text-xs text-muted-foreground">In cluster {{ clusterId }}</p>

        <ui-form-field v-slot="{ fieldId, describedBy }" label="Kind">
          <select
              :id="fieldId"
              v-model="draft.resource"
              :aria-describedby="describedBy"
              class="ui-input"
              @change="targetChanged"
          >
            <option value="pods">Pod</option>
            <option value="services">Service</option>
          </select>
        </ui-form-field>

        <ui-suggest-field
            v-model="draft.namespace"
            :error="errors.namespace"
            :options="namespaces"
            label="Namespace"
            placeholder="default"
            @change="targetChanged"
        />

        <ui-suggest-field
            v-model="draft.name"
            :error="errors.name"
            :options="portForwardStore.names"
            class="col-span-2"
            label="Name"
            @change="discover"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <ui-combo-field
            v-model="draft.remotePort"
            :error="errors.remotePort"
            :options="portOptions"
            :placeholder="portPlaceholder"
            label="Remote port"
        />

        <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.localPort" label="Local port">
          <input
              :id="fieldId"
              v-model="draft.localPort"
              :aria-describedby="describedBy"
              :aria-invalid="errors.localPort ? 'true' : undefined"
              autocomplete="off"
              class="ui-input tabular"
              inputmode="numeric"
              placeholder="Any free port"
              type="text"
              @keydown.enter.prevent="submit"
          >
        </ui-form-field>
      </div>

      <port-forward-mode-field v-model="draft.restoreMode" :error="errors.restoreMode" />
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiComboField from '@/components/common/form/UiComboField.vue'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiSuggestField from '@/components/common/form/UiSuggestField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import PortForwardModeField from '@/components/terminal/PortForwardModeField.vue'
import PortForwardTargetSummary from '@/components/terminal/PortForwardTargetSummary.vue'
import { PortForwardPortOptions } from '@/components/terminal/PortForwardPortOptions'
import type { TUiComboOption } from '@/components/common/form/types/TUiComboOption'
import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import { PortForwardValidator } from '@/application/validators/PortForwardValidator'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward'
import type { TPortForwardRemotePort, TPortForwardResource } from '@/domain/entities/portForward'
import type { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { PortForwardModeField, PortForwardTargetSummary, UiComboField, UiFormField, UiModal, UiSuggestField },
  emits: ['cancel', 'submit'],
})
export default class PortForwardForm extends VueBase {
  @Prop({ required: true, type: Boolean })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly request: OpenPortForwardEvent | null

  @Prop({ required: false, default: null })
  public readonly forward: TPortForward | null

  @Prop({ required: false, type: Boolean, default: false })
  public readonly busy?: boolean

  public draft: TPortForwardDraft = {
    resource: PortForwardLabel.pods,
    namespace: '',
    name: '',
    remotePort: '',
    localPort: '',
    restoreMode: PortForwardRestoreModeCatalog.defaultMode,
  }

  public errors: Record<string, string> = {}

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
      @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
      @inject(PortForwardValidator) private readonly validator: PortForwardValidator,
  ) {
    super()
  }

  public get clusterId(): string {
    return this.forward?.clusterId ?? this.request?.clusterId ?? ''
  }

  public get editing(): boolean {
    return this.forward !== null
  }

  public get targetLocked(): boolean {
    return this.editing || (this.request?.hasTarget ?? false)
  }

  public get title(): string {
    return this.editing ? 'Edit port forward' : 'Forward a port'
  }

  public get submitLabel(): string {
    return this.editing ? 'Save' : 'Forward'
  }

  public get namespaces(): string[] {
    return this.namespaceStore.availableOf(this.clusterId)
  }

  public get portOptions(): TUiComboOption[] {
    return PortForwardPortOptions.of(this.portForwardStore.ports)
  }

  public get portPlaceholder(): string {
    return this.portForwardStore.loadingPorts ? 'Reading declared ports' : 'Number or name'
  }

  @Watch('request')
  async requestChanged(request: OpenPortForwardEvent | null): Promise<void> {
    if (!request) {
      return
    }

    this.reset()
    await this.prepare()
  }

  @Watch('portForwardStore.ports')
  portsChanged(): void {
    if (!this.open || this.draft.remotePort.trim() !== '') {
      return
    }

    this.draft.remotePort = PortForwardPortOptions.initial(this.portForwardStore.ports, '')
  }

  public async targetChanged(): Promise<void> {
    await Promise.all([
      this.portForwardStore.loadNames(this.clusterId, this.draft.namespace.trim(), this.draft.resource),
      this.discover(),
    ])
  }

  public async discover(): Promise<void> {
    await this.portForwardStore.loadPorts(
        this.clusterId,
        this.draft.namespace.trim(),
        this.draft.resource,
        this.draft.name.trim(),
    )
  }

  public submit(): void {
    if (this.busy) {
      return
    }

    const result = this.validator.validate(this.draft, this.takenPorts())
    this.errors = result.errors

    if (!result.valid) {
      return
    }

    const request: TPortForwardRequest = {
      clusterId: this.clusterId,
      namespace: this.draft.namespace.trim(),
      resource: this.resourceOf(this.draft.resource),
      name: this.draft.name.trim(),
      ...PortForwardValidator.parse(this.draft),
    }

    this.$emit('submit', request)
  }

  private reset(): void {
    this.errors = {}
    this.portForwardStore.clearPorts()

    const forward = this.forward
    if (forward) {
      this.draft = {
        resource: forward.resource,
        namespace: forward.namespace,
        name: forward.name,
        remotePort: String(forward.remotePort),
        localPort: forward.localPort > 0 ? String(forward.localPort) : '',
        restoreMode: forward.restoreMode,
      }
      return
    }

    this.draft = {
      resource: this.resourceOf(this.request?.resource ?? ''),
      namespace: this.request?.namespace ?? '',
      name: this.request?.name ?? '',
      remotePort: PortForwardPortOptions.initial([], this.request?.remotePort ?? ''),
      localPort: '',
      restoreMode: PortForwardRestoreModeCatalog.defaultMode,
    }
  }

  private async prepare(): Promise<void> {
    if (this.targetLocked) {
      await this.discover()
      return
    }

    await Promise.all([
      this.namespaceStore.loadFor(this.clusterId),
      this.portForwardStore.loadNames(this.clusterId, this.draft.namespace.trim(), this.draft.resource),
    ])
  }

  private takenPorts(): TPortForwardRemotePort[] {
    const forward = this.forward
    if (!forward) {
      return []
    }

    return this.portForwardStore.remotePortsOn(forward.clusterId, forward.namespace, forward.resource, forward.name, forward.id)
  }

  private resourceOf(resource: string): TPortForwardResource {
    return resource === PortForwardLabel.services ? 'services' : 'pods'
  }
}
</script>
