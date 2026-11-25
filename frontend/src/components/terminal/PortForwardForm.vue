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

      <fieldset
          v-if="hasDeclaredPorts"
          :aria-describedby="errors.remotePort ? remotePortErrorId : undefined"
          class="space-y-2"
      >
        <legend class="text-sm text-muted-foreground">Remote port</legend>

        <div class="grid gap-1">
          <label
              v-for="port in portForwardStore.ports"
              :key="portKey(port)"
              :class="[
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                isPortForwardable(port) ? 'cursor-pointer hover:bg-muted' : 'cursor-not-allowed opacity-60',
                isDeclaredSelected(port) ? 'border-primary/40 bg-primary/5' : 'border-border',
              ]"
          >
            <input
                :checked="isDeclaredSelected(port)"
                :disabled="!isPortForwardable(port)"
                :name="portGroupName"
                :value="String(port.port)"
                class="shrink-0 accent-primary"
                type="radio"
                @change="selectDeclaredPort(port)"
            >
            <span class="min-w-0 truncate font-medium text-foreground tabular">{{ portLabel(port) }}</span>
            <span v-if="port.container" class="truncate text-xs text-muted-foreground">({{ port.container }})</span>
            <span class="ml-auto shrink-0 text-xs text-muted-foreground">
              {{ isPortForwardable(port) ? port.protocol : `${port.protocol} · cannot be forwarded` }}
            </span>
          </label>

          <div
              :class="[
                'rounded-md border px-3 py-2 transition-colors',
                isCustomPort ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted',
              ]"
          >
            <label class="flex cursor-pointer items-center gap-2 text-sm">
              <input
                  :checked="isCustomPort"
                  :name="portGroupName"
                  :value="customChoice"
                  class="shrink-0 accent-primary"
                  type="radio"
                  @change="selectCustomPort"
              >
              <span class="font-medium text-foreground">Another port</span>
            </label>

            <input
                v-if="isCustomPort"
                v-model="customRemotePort"
                :aria-invalid="errors.remotePort ? 'true' : undefined"
                aria-label="Remote port number or name"
                autocomplete="off"
                class="ui-input mt-2 tabular"
                placeholder="Number or name"
                type="text"
                @input="onCustomRemotePortInput"
                @keydown.enter.prevent="submit"
            >
          </div>
        </div>

        <p v-if="errors.remotePort" :id="remotePortErrorId" class="text-xs text-destructive" role="alert">
          {{ errors.remotePort }}
        </p>
      </fieldset>

      <ui-form-field v-else v-slot="{ fieldId, describedBy }" :error="errors.remotePort" label="Remote port">
        <input
            :id="fieldId"
            v-model="draft.remotePort"
            :aria-describedby="describedBy"
            :aria-invalid="errors.remotePort ? 'true' : undefined"
            :placeholder="portPlaceholder"
            autocomplete="off"
            class="ui-input tabular"
            type="text"
            @input="onManualRemotePortInput"
            @keydown.enter.prevent="submit"
        >
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.localPort" label="Local port">
        <div class="flex items-center gap-2">
          <input
              :id="fieldId"
              v-model="draft.localPort"
              :aria-describedby="describedBy"
              :aria-invalid="errors.localPort ? 'true' : undefined"
              autocomplete="off"
              class="ui-input flex-1 tabular"
              inputmode="numeric"
              placeholder="Any free port"
              type="text"
              @input="onLocalPortInput"
              @keydown.enter.prevent="submit"
          >
          <button
              class="btn-secondary shrink-0"
              title="Use any free local port"
              type="button"
              @click="useRandomLocalPort"
          >
            Random
          </button>
        </div>

        <p v-if="showPortCheck" :class="portCheckClass" class="mt-1 flex items-center gap-1 text-xs">
          <loader-circle v-if="portCheckState === 'checking'" :size="14" class="shrink-0 animate-spin" />
          <circle-check v-else-if="portCheckState === 'free'" :size="14" class="shrink-0" />
          <triangle-alert v-else-if="portCheckState === 'taken'" :size="14" class="shrink-0" />
          <span class="tabular">{{ portCheckText }}</span>
        </p>
      </ui-form-field>

      <div v-if="!editing || !isSavedForward" class="space-y-2">
        <ui-toggle
            v-if="!editing"
            v-model="openInBrowser"
            description="Open http://127.0.0.1 once the local port is bound"
            label="Open in browser when it starts"
        />
        <ui-toggle
            v-model="saveForLater"
            description="Keep this forward in your list across sessions"
            label="Save for later"
        />
      </div>

      <port-forward-mode-field
          v-if="showRestoreMode"
          v-model="draft.restoreMode"
          :error="errors.restoreMode"
      />
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { CircleCheck, LoaderCircle, TriangleAlert } from '@lucide/vue'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiSuggestField from '@/components/common/form/UiSuggestField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'
import PortForwardModeField from '@/components/terminal/PortForwardModeField.vue'
import PortForwardTargetSummary from '@/components/terminal/PortForwardTargetSummary.vue'
import { PortForwardPortOptions } from '@/components/terminal/PortForwardPortOptions'
import { IdService } from '@/application/services/id/IdService'
import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import { PortForwardValidator } from '@/application/validators/PortForwardValidator'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward'
import type { TPortForwardRemotePort, TPortForwardResource } from '@/domain/entities/portForward'
import type { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: {
    CircleCheck,
    LoaderCircle,
    PortForwardModeField,
    PortForwardTargetSummary,
    TriangleAlert,
    UiFormField,
    UiModal,
    UiSuggestField,
    UiToggle,
  },
  emits: ['cancel', 'submit'],
})
export default class PortForwardForm extends VueBase {
  private static readonly portCheckDelayMs: number = 200

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

  public portGroupName = ''

  public portChoice = ''

  public customRemotePort = ''

  public openInBrowser = false

  public saveForLater = false

  public portCheckState: 'idle' | 'checking' | 'free' | 'taken' = 'idle'

  public checkedPort = 0

  private localPortTouched = false

  private portCheckTimer: ReturnType<typeof setTimeout> | null = null

  private portCheckRequest = 0

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
      @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
      @inject(PortForwardValidator) private readonly validator: PortForwardValidator,
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.portGroupName = `remote-port-${this.idService.next()}`
  }

  beforeUnmount(): void {
    this.clearPortCheck()
  }

  public get clusterId(): string {
    return this.forward?.clusterId ?? this.request?.clusterId ?? ''
  }

  public get editing(): boolean {
    return this.forward !== null
  }

  public get isSavedForward(): boolean {
    return this.forward !== null && PortForwardRecord.isSaved(this.forward)
  }

  public get showRestoreMode(): boolean {
    return this.editing ? (this.isSavedForward || this.saveForLater) : this.saveForLater
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

  public get hasDeclaredPorts(): boolean {
    return this.portForwardStore.ports.length > 0
  }

  public get customChoice(): string {
    return PortForwardPortOptions.customChoice
  }

  public get isCustomPort(): boolean {
    return this.portChoice === PortForwardPortOptions.customChoice
  }

  public get remotePortErrorId(): string {
    return `${this.portGroupName}-error`
  }

  public get portPlaceholder(): string {
    return this.portForwardStore.loadingPorts ? 'Reading declared ports' : 'Number or name'
  }

  public get showPortCheck(): boolean {
    return this.portCheckState !== 'idle' && !this.errors.localPort
  }

  public get portCheckText(): string {
    if (this.portCheckState === 'checking') {
      return 'Checking port…'
    }
    if (this.portCheckState === 'free') {
      return `Port ${this.checkedPort} is free`
    }
    if (this.portCheckState === 'taken') {
      return `Port ${this.checkedPort} is already in use`
    }

    return ''
  }

  public get portCheckClass(): string {
    if (this.portCheckState === 'free') {
      return 'text-success'
    }
    if (this.portCheckState === 'taken') {
      return 'text-warning'
    }

    return 'text-muted-foreground'
  }

  @Watch('open')
  openChanged(isOpen: boolean): void {
    if (!isOpen) {
      this.clearPortCheck()
    }
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
    if (!this.open) {
      return
    }

    const ports = this.portForwardStore.ports
    if (ports.length === 0) {
      this.portChoice = ''
      return
    }

    const current = this.draft.remotePort.trim()
    if (current === '') {
      const initial = PortForwardPortOptions.initial(ports, '')
      if (initial !== '') {
        this.portChoice = initial
        this.draft.remotePort = initial
        this.applySuggestedLocalPort(initial)
      } else {
        this.portChoice = ''
      }
      return
    }

    const matched = PortForwardPortOptions.matchingValue(ports, current)
    if (matched !== '') {
      this.portChoice = matched
      if (!this.editing && !this.localPortTouched && this.draft.localPort.trim() === '') {
        this.applySuggestedLocalPort(matched)
      }
      return
    }

    this.portChoice = PortForwardPortOptions.customChoice
    this.customRemotePort = current
  }

  public portKey(port: TPortForwardPort): string {
    return `${port.container ?? ''}:${port.port}:${port.protocol}:${port.name}`
  }

  public portLabel(port: TPortForwardPort): string {
    return PortForwardPortOptions.labelOf(port)
  }

  public isPortForwardable(port: TPortForwardPort): boolean {
    return PortForwardPortOptions.isForwardable(port)
  }

  public isDeclaredSelected(port: TPortForwardPort): boolean {
    return this.portChoice === String(port.port)
  }

  public selectDeclaredPort(port: TPortForwardPort): void {
    if (!PortForwardPortOptions.isForwardable(port)) {
      return
    }

    const value = String(port.port)
    this.portChoice = value
    this.draft.remotePort = value
    this.applySuggestedLocalPort(value)
  }

  public selectCustomPort(): void {
    this.portChoice = PortForwardPortOptions.customChoice
    this.draft.remotePort = this.customRemotePort
  }

  public onCustomRemotePortInput(): void {
    this.draft.remotePort = this.customRemotePort
    this.applySuggestedLocalPort(this.customRemotePort)
  }

  public onManualRemotePortInput(): void {
    this.applySuggestedLocalPort(this.draft.remotePort)
  }

  public onLocalPortInput(): void {
    this.localPortTouched = true
    this.schedulePortCheck()
  }

  public useRandomLocalPort(): void {
    this.localPortTouched = true
    this.draft.localPort = ''
    if (this.errors.localPort) {
      const rest = { ...this.errors }
      delete rest.localPort
      this.errors = rest
    }
    this.clearPortCheck()
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

    const shouldSave = this.editing && this.isSavedForward ? true : this.saveForLater
    const draft: TPortForwardDraft = {
      ...this.draft,
      save: shouldSave,
      openInBrowser: this.editing ? false : this.openInBrowser,
    }

    const result = this.validator.validate(draft, this.takenPorts())
    this.errors = result.errors

    if (!result.valid) {
      return
    }

    const parsed = PortForwardValidator.parse(draft)
    const request: TPortForwardRequest = {
      clusterId: this.clusterId,
      namespace: draft.namespace.trim(),
      resource: this.resourceOf(draft.resource),
      name: draft.name.trim(),
      remotePort: parsed.remotePort,
      localPort: parsed.localPort,
      restoreMode: shouldSave ? parsed.restoreMode : 'manual',
      save: shouldSave,
      openInBrowser: draft.openInBrowser,
    }

    this.$emit('submit', request)
  }

  private reset(): void {
    this.errors = {}
    this.clearPortCheck()
    this.portForwardStore.clearPorts()
    this.localPortTouched = false
    this.portChoice = ''
    this.customRemotePort = ''
    this.openInBrowser = false

    const forward = this.forward
    if (forward) {
      this.saveForLater = PortForwardRecord.isSaved(forward)
      this.draft = {
        resource: forward.resource,
        namespace: forward.namespace,
        name: forward.name,
        remotePort: String(forward.remotePort),
        localPort: forward.localPort > 0 ? String(forward.localPort) : '',
        restoreMode: forward.restoreMode,
      }
      this.customRemotePort = this.draft.remotePort
      if (this.draft.localPort !== '') {
        this.schedulePortCheck()
      }
      return
    }

    this.saveForLater = false
    const presetRemote = PortForwardPortOptions.initial([], this.request?.remotePort ?? '')
    const suggestedLocal = PortForwardPortOptions.suggestedLocalPort(presetRemote)
    this.draft = {
      resource: this.resourceOf(this.request?.resource ?? ''),
      namespace: this.request?.namespace ?? '',
      name: this.request?.name ?? '',
      remotePort: presetRemote,
      localPort: suggestedLocal,
      restoreMode: PortForwardRestoreModeCatalog.defaultMode,
    }
    this.customRemotePort = presetRemote
    if (suggestedLocal !== '') {
      this.schedulePortCheck()
    }
  }

  private applySuggestedLocalPort(remotePort: string): void {
    if (this.editing || this.localPortTouched) {
      return
    }

    this.draft.localPort = PortForwardPortOptions.suggestedLocalPort(remotePort)
    this.schedulePortCheck()
  }

  private schedulePortCheck(): void {
    this.clearPortCheck()

    const port = PortForwardPortOptions.parseLocalPort(this.draft.localPort)
    if (port === null || (this.forward !== null && this.forward.boundPort > 0 && port === this.forward.boundPort)) {
      return
    }

    const request = ++this.portCheckRequest
    this.checkedPort = port
    this.portCheckState = 'checking'

    this.portCheckTimer = setTimeout(() => {
      this.portCheckTimer = null
      void this.runPortCheck(port, request)
    }, PortForwardForm.portCheckDelayMs)
  }

  private async runPortCheck(port: number, request: number): Promise<void> {
    const result = await this.portForwardStore.checkPort(port)
    if (request !== this.portCheckRequest || !this.open) {
      return
    }

    if (!result.checked) {
      this.portCheckState = 'idle'
      this.checkedPort = 0
      return
    }

    this.portCheckState = result.available ? 'free' : 'taken'
  }

  private clearPortCheck(): void {
    this.portCheckRequest += 1
    if (this.portCheckTimer !== null) {
      clearTimeout(this.portCheckTimer)
      this.portCheckTimer = null
    }
    this.portCheckState = 'idle'
    this.checkedPort = 0
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
