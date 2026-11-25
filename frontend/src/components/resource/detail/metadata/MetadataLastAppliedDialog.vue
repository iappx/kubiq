<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
          v-if="open"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
            class="absolute inset-0 bg-foreground/20"
            @click="$emit('close')"
        />
        <div
            ref="panel"
            :aria-labelledby="titleId"
            aria-modal="true"
            class="surface-raised modal-panel relative z-10 flex w-full max-w-4xl flex-col gap-4 p-6"
            role="dialog"
        >
          <div class="flex items-center justify-between gap-3">
            <h2 :id="titleId" class="text-base font-semibold text-foreground">
              Last applied vs current
            </h2>
            <button
                aria-label="Close"
                class="btn-icon h-7 w-7"
                title="Close"
                type="button"
                @click="$emit('close')"
            >
              <x :size="16" />
            </button>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-xs">
              <template v-if="diff === null">
                <span class="text-muted-foreground">Unable to compare last-applied configuration</span>
              </template>
              <template v-else-if="diff.hasChanges">
                <span class="font-mono font-medium tabular text-success">+{{ diff.summary.added }}</span>
                <span class="text-muted-foreground">/</span>
                <span class="font-mono font-medium tabular text-destructive">-{{ diff.summary.removed }}</span>
              </template>
              <template v-else>
                <span class="text-success">Matches current cluster state</span>
              </template>
            </div>

            <div v-if="diff !== null" class="flex flex-wrap items-center gap-2">
              <div class="flex items-center gap-1" role="group" aria-label="Diff view mode">
                <button
                    :aria-pressed="condensed"
                    :class="[
                      'inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors',
                      condensed
                        ? 'pill-active border-primary/30'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                    ]"
                    type="button"
                    @click="setCondensed(true)"
                >
                  Condensed
                </button>
                <button
                    :aria-pressed="!condensed"
                    :class="[
                      'inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors',
                      !condensed
                        ? 'pill-active border-primary/30'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                    ]"
                    type="button"
                    @click="setCondensed(false)"
                >
                  Full
                </button>
              </div>

              <button
                  class="btn-secondary h-7 px-2.5 text-xs"
                  type="button"
                  @click="copyAppliedYaml"
              >
                <copy :size="14" />
                Copy applied YAML
              </button>
            </div>
          </div>

          <div v-if="diff === null" class="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            The last-applied configuration is not a valid Kubernetes object and cannot be compared.
          </div>

          <div
              v-else-if="!diff.hasChanges && condensed"
              class="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground"
          >
            Matches current cluster state after stripping cluster-managed fields. Switch to Full to inspect the normalized manifest.
          </div>

          <div v-else class="max-h-[65vh] overflow-auto">
            <resource-diff-view
                :lines="visibleLines"
                label="Last applied configuration against current cluster state"
            />
          </div>

          <div class="flex justify-end">
            <button
                class="btn-secondary h-7 px-3 text-xs"
                type="button"
                @click="$emit('close')"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import { Component, Prop, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Copy, X } from '@lucide/vue'
import { IdService } from '@/application/services/id/IdService'
import { LastAppliedDiff } from '@/application/services/resourceYaml/models/LastAppliedDiff'
import type { TLastAppliedDiffResult } from '@/application/services/resourceYaml/types/TLastAppliedDiffResult'
import type { TYamlDiffLine } from '@/application/services/resourceYaml/types/TYamlDiffLine'
import { ModalShellBase } from '@/components/base/modals/ModalShellBase'
import ResourceDiffView from '@/components/resource/detail/ResourceDiffView.vue'

@Component({
  components: { Copy, ResourceDiffView, X },
  emits: ['close', 'copy'],
})
export default class MetadataLastAppliedDialog extends ModalShellBase {
  @Prop({ required: true, type: Boolean })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly lastApplied: unknown

  @Prop({ required: true })
  public readonly currentObject: Record<string, unknown>

  public titleId = ''

  public condensed = true

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  public get diff(): TLastAppliedDiffResult | null {
    if (!this.open) {
      return null
    }

    return LastAppliedDiff.compare(this.lastApplied, this.currentObject)
  }

  public get visibleLines(): TYamlDiffLine[] {
    if (this.diff === null) {
      return []
    }

    return this.condensed ? this.diff.condensedLines : this.diff.lines
  }

  created(): void {
    this.titleId = `last-applied-diff-title-${this.idService.next()}`
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.condensed = true
    }
    void this.handleOpenChange(open)
  }

  public setCondensed(value: boolean): void {
    this.condensed = value
  }

  public copyAppliedYaml(): void {
    if (this.diff === null) {
      return
    }

    this.$emit('copy', {
      text: this.diff.appliedYaml,
      label: 'Copied last-applied YAML',
    })
  }

  protected isOpen(): boolean {
    return this.open
  }

  protected onEscape(): void {
    this.$emit('close')
  }
}
</script>
