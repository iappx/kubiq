<template>
  <ui-modal
      v-model:open="open"
      :loading="saving"
      submit-label="Save"
      title="Customize cluster"
      @close="close"
      @submit="submit"
  >
    <div class="space-y-4">
      <cluster-appearance-header
          :busy="saving"
          :can-reset="isCustomized"
          :context-name="clusterId"
          :icon="previewIcon"
          :name="previewName"
          @reset="reset"
      />

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.displayName" label="Display name">
        <input
            :id="fieldId"
            v-model="draft.displayName"
            :aria-describedby="describedBy"
            :aria-invalid="errors.displayName ? 'true' : undefined"
            :placeholder="clusterId"
            autocomplete="off"
            class="ui-input"
            spellcheck="false"
            type="text"
            @keydown.enter.prevent="submit"
        >
      </ui-form-field>
      <p class="-mt-2 text-xs text-muted-foreground">
        Shown instead of the context name everywhere in Kubiq. The kubeconfig is left as it is.
      </p>

      <cluster-icon-editor
          v-model="draft"
          :can-choose-image="canChooseImage"
          :errors="errors"
          :image-name="imageName"
          @choose-image="chooseImage"
      />
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import ClusterAppearanceHeader from '@/components/cluster/customize/ClusterAppearanceHeader.vue'
import ClusterIconEditor from '@/components/cluster/customize/ClusterIconEditor.vue'
import { ClusterAppearanceService } from '@/application/services/clusterAppearance/ClusterAppearanceService'
import { ClusterIconFile } from '@/application/services/clusterAppearance/models/ClusterIconFile'
import { ClusterAppearanceValidator } from '@/application/validators/ClusterAppearanceValidator'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { OpenClusterCustomizeEvent } from '@/domain/events/cluster/OpenClusterCustomizeEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterAppearanceStore } from '@/store/modules/clusterAppearance/ClusterAppearanceStore'

@Component({
  components: { ClusterAppearanceHeader, ClusterIconEditor, UiFormField, UiModal },
})
export default class ClusterCustomizeModal extends VueBase {
  public open = false

  public saving = false

  public clusterId = ''

  public draft: TClusterAppearanceDraft = ClusterAppearanceService.draftOf(ClusterAppearanceService.defaultOf(''))

  public errors: Record<string, string> = {}

  public storedImageUrl = ''

  public imageUrl = ''

  private onOpenRequested!: (event: OpenClusterCustomizeEvent) => void

  constructor(
      @inject(ClusterAppearanceStore) public readonly appearanceStore: ClusterAppearanceStore,
      @inject(ClusterAppearanceService) private readonly appearanceService: ClusterAppearanceService,
      @inject(ClusterAppearanceValidator) private readonly validator: ClusterAppearanceValidator,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get isCustomized(): boolean {
    return this.appearanceStore.isCustomized(this.clusterId)
  }

  public get canChooseImage(): boolean {
    return this.appearanceService.canChooseImage
  }

  public get previewName(): string {
    return this.draft.displayName.trim() || this.clusterId
  }

  public get previewIcon(): TClusterIcon {
    return {
      kind: this.draft.iconKind,
      initials: ClusterMonogram.normalize(this.draft.initials) || ClusterMonogram.initialsOf(this.clusterId),
      color: ClusterIconColorCatalog.of(this.draft.color),
      glyph: this.draft.glyph,
      imageUrl: this.imageUrl,
    }
  }

  public get imageName(): string {
    if (this.draft.imageFile !== '') {
      return ClusterIconFile.nameOf(this.draft.imageFile)
    }

    return this.storedImageUrl !== '' ? 'Current image' : ''
  }

  created(): void {
    this.onOpenRequested = event => void this.show(event.clusterId)
    this.eventBus.registerHandler(OpenClusterCustomizeEvent, this.onOpenRequested)
  }

  beforeUnmount(): void {
    this.eventBus.unregisterHandler(OpenClusterCustomizeEvent, this.onOpenRequested)
  }

  public close(): void {
    if (!this.saving) {
      this.open = false
    }
  }

  public async chooseImage(): Promise<void> {
    try {
      const path = await this.appearanceService.chooseImage()
      if (path === '') {
        return
      }

      this.imageUrl = await this.appearanceService.previewOf(path)
      this.draft = { ...this.draft, iconKind: 'image', imageFile: path }
      this.errors = { ...this.errors, image: '' }
    } catch (err) {
      this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterCustomizeModal.chooseImage'))
    }
  }

  public async submit(): Promise<void> {
    if (this.saving) {
      return
    }

    const result = this.validator.validate(this.draft, this.storedImageUrl !== '')
    this.errors = result.errors

    if (!result.valid) {
      return
    }

    this.saving = true
    try {
      if (await this.appearanceStore.save(this.clusterId, this.draft)) {
        this.open = false
      }
    } finally {
      this.saving = false
    }
  }

  public async reset(): Promise<void> {
    if (this.saving) {
      return
    }

    this.saving = true
    try {
      if (await this.appearanceStore.reset(this.clusterId)) {
        this.open = false
      }
    } finally {
      this.saving = false
    }
  }

  private async show(clusterId: string): Promise<void> {
    if (this.saving || clusterId === '') {
      return
    }

    await this.appearanceStore.loadOnce()

    const appearance = this.appearanceStore.appearanceOf(clusterId)
    this.clusterId = clusterId
    this.draft = ClusterAppearanceService.draftOf(appearance)
    this.storedImageUrl = appearance.icon.imageUrl
    this.imageUrl = appearance.icon.imageUrl
    this.errors = {}
    this.open = true
  }
}
</script>
