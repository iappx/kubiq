<template>
  <ui-side-panel
      :label="panelLabel"
      :open="open"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>Sync {{ applicationName }}</template>
    <template #subtitle>{{ subtitle }}</template>

    <div class="space-y-3">
      <ui-form-field v-slot="{ fieldId, describedBy }" :error="fieldErrors.revision" label="Revision">
        <input
            :id="fieldId"
            v-model="draft.revision"
            :aria-describedby="describedBy"
            :aria-invalid="fieldErrors.revision ? 'true' : undefined"
            :disabled="busy"
            :placeholder="revisionPlaceholder"
            autocomplete="off"
            class="ui-input h-9 text-sm"
            spellcheck="false"
            type="text"
        >
      </ui-form-field>

      <ui-toggle
          v-model="draft.prune"
          description="Objects the repository no longer declares are deleted from the cluster"
          label="Prune"
      />

      <ui-toggle
          v-model="draft.dryRun"
          description="Argo CD reports what it would change and writes nothing"
          label="Dry run"
      />

      <ui-toggle
          v-model="draft.force"
          description="Objects are replaced with --force when a normal apply is refused"
          label="Force"
      />

      <ui-toggle
          v-model="draft.replace"
          description="Objects are recreated instead of patched"
          label="Replace"
      />

      <ui-toggle
          v-model="draft.applyOutOfSyncOnly"
          description="Only the objects Argo CD reports as out of sync are touched"
          label="Apply out-of-sync only"
      />

      <p v-if="fieldErrors.replace" class="text-xs text-destructive" role="alert">{{ fieldErrors.replace }}</p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button :disabled="busy" class="btn-ghost disabled:opacity-50" type="button" @click="$emit('close')">
          Cancel
        </button>
        <button :disabled="busy" class="btn-primary disabled:opacity-70" type="button" @click="submit">
          <loader-circle v-if="busy" :size="14" class="animate-spin" />
          {{ submitLabel }}
        </button>
      </div>
    </template>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { LoaderCircle } from '@lucide/vue'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'
import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'
import { ArgoSyncDraftDefaults } from '@/domain/models/argocd'

@Component({
  components: { LoaderCircle, UiFormField, UiSidePanel, UiToggle },
  emits: ['close', 'submit', 'update:width'],
})
export default class ArgoSyncPanel extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: '' })
  public readonly applicationName?: string

  @Prop({ required: false, default: '' })
  public readonly targetRevision?: string

  @Prop({ required: false, default: '' })
  public readonly initialRevision?: string

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  @Prop({ required: false, default: () => ({}) })
  public readonly errors?: Record<string, string>

  public draft: TArgoSyncDraft = ArgoSyncDraftDefaults.blank()

  public get fieldErrors(): Record<string, string> {
    return this.errors ?? {}
  }

  public get panelLabel(): string {
    return `Sync the Argo CD application ${this.applicationName}`
  }

  public get subtitle(): string {
    return this.initialRevision === ''
        ? 'Argo CD applies what the repository declares'
        : `Rolling back to ${this.initialRevision}`
  }

  public get revisionPlaceholder(): string {
    return this.targetRevision === ''
        ? 'Leave empty for the revision the application tracks'
        : `Leave empty for ${this.targetRevision}`
  }

  public get submitLabel(): string {
    return this.draft.dryRun ? 'Run the dry run' : 'Sync'
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.draft = ArgoSyncDraftDefaults.atRevision(this.initialRevision ?? '')
    }
  }

  public submit(): void {
    this.$emit('submit', { ...this.draft })
  }
}
</script>
