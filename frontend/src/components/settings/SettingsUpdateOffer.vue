<template>
  <div class="space-y-3 rounded-md border border-border p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h4 class="truncate text-sm font-semibold text-foreground">{{ offer.title }}</h4>
          <span v-if="skipped" class="pill">Skipped</span>
        </div>
        <p class="text-xs text-muted-foreground">{{ summary }}</p>
      </div>

      <button v-if="offer.notesUrl" class="btn-secondary shrink-0" type="button" @click="$emit('open-release')">
        <external-link :size="14" aria-hidden="true" />
        Release notes
      </button>
    </div>

    <settings-update-progress
        v-if="phase === 'downloading'"
        :received="received"
        :total="total"
        @cancel="$emit('cancel')"
    />

    <p v-else-if="phase === 'downloaded' || phase === 'installing'" class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <shield-check :size="14" aria-hidden="true" class="text-success" />
      Downloaded, checksum verified
    </p>

    <p v-else-if="!offer.installable" class="text-xs text-muted-foreground">{{ manualHint }}</p>

    <div v-if="hasActions" class="flex flex-wrap gap-2">
      <button v-if="canDownload" class="btn-primary" type="button" @click="$emit('download')">
        <download :size="14" aria-hidden="true" />
        Download
      </button>

      <button
          v-if="phase === 'downloaded' || phase === 'installing'"
          :disabled="phase === 'installing'"
          class="btn-primary"
          type="button"
          @click="confirming = true"
      >
        <loader-circle v-if="phase === 'installing'" :size="14" aria-hidden="true" class="animate-spin" />
        <rotate-cw v-else :size="14" aria-hidden="true" />
        Install and restart
      </button>

      <button v-if="phase === 'available' && !skipped" class="btn-secondary" type="button" @click="$emit('skip')">
        Skip this version
      </button>

      <button v-if="phase === 'available' && skipped" class="btn-secondary" type="button" @click="$emit('unskip')">
        Stop skipping
      </button>
    </div>

    <confirm-dialog
        :description="confirmText"
        :open="confirming"
        :title="`Install ${offer.title}?`"
        confirm-label="Install and restart"
        variant="warning"
        @cancel="confirming = false"
        @confirm="install"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Download, ExternalLink, LoaderCircle, RotateCw, ShieldCheck } from '@lucide/vue'
import { DateTime } from 'luxon'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import SettingsUpdateProgress from '@/components/settings/SettingsUpdateProgress.vue'
import type { TUpdateOffer } from '@/application/services/update/types/TUpdateOffer'
import { MetricFormat } from '@/domain/models/metrics/MetricFormat'
import type { TUpdatePhase } from '@/store/modules/update/types/TUpdatePhase'

@Component({
  components: { ConfirmDialog, Download, ExternalLink, LoaderCircle, RotateCw, SettingsUpdateProgress, ShieldCheck },
  emits: ['download', 'cancel', 'install', 'skip', 'unskip', 'open-release'],
})
export default class SettingsUpdateOffer extends VueBase {
  @Prop({ required: true })
  public readonly offer: TUpdateOffer

  @Prop({ required: true })
  public readonly phase: TUpdatePhase

  @Prop({ required: true, type: Number })
  public readonly received: number

  @Prop({ required: true, type: Number })
  public readonly total: number

  @Prop({ required: true, type: Boolean })
  public readonly skipped: boolean

  public confirming = false

  public get summary(): string {
    const parts: string[] = []

    const published = DateTime.fromISO(this.offer.publishedAt)
    if (published.isValid) {
      parts.push(`Published ${published.toLocaleString(DateTime.DATE_MED)}`)
    }
    if (this.offer.asset) {
      parts.push(`installer ${MetricFormat.bytes(this.offer.asset.size)}`)
    }

    return parts.join(' · ')
  }

  public get canDownload(): boolean {
    return this.phase === 'available' && this.offer.installable
  }

  public get hasActions(): boolean {
    return this.phase === 'available' || this.phase === 'downloaded' || this.phase === 'installing'
  }

  public get manualHint(): string {
    return this.offer.asset
      ? 'This copy of kubiq was not set up by the installer, so it cannot replace itself. Get the new version from the release page.'
      : 'This release has no installer for your system. Get the new version from the release page.'
  }

  public get confirmText(): string {
    return 'kubiq closes, the installer replaces it and starts the new version. '
      + 'Settings, clusters and the journal are kept; open terminals and port forwards end.'
  }

  public install(): void {
    this.confirming = false
    this.$emit('install')
  }
}
</script>
