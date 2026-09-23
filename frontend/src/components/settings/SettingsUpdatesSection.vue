<template>
  <ui-section
      description="kubiq looks for new releases on GitHub. Nothing is downloaded or installed until you ask."
      title="Updates"
  >
    <template #actions>
      <button :disabled="checkDisabled" class="btn-secondary" type="button" @click="$emit('check')">
        <loader-circle v-if="phase === 'checking'" :size="14" aria-hidden="true" class="animate-spin" />
        <refresh-cw v-else :size="14" aria-hidden="true" />
        Check now
      </button>
    </template>

    <dl class="grid gap-3 sm:grid-cols-2">
      <div>
        <dt class="text-xs text-muted-foreground">Installed version</dt>
        <dd class="text-sm text-foreground tabular">{{ currentVersion }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted-foreground">Latest release</dt>
        <dd class="text-sm text-foreground">
          {{ statusText }}
          <span v-if="checkedAt > 0 && phase !== 'checking'" class="text-xs text-muted-foreground">
            · checked <ui-age :value="checkedAt" /> ago
          </span>
        </dd>
      </div>
    </dl>

    <p v-if="checkError && phase !== 'checking'" class="text-xs text-destructive">{{ checkError }}</p>

    <settings-update-offer
        v-if="offer && hasOffer"
        :offer="offer"
        :phase="phase"
        :received="received"
        :skipped="offer.version === skippedVersion"
        :total="total"
        @cancel="$emit('cancel')"
        @download="$emit('download')"
        @install="$emit('install')"
        @open-release="$emit('open-release')"
        @skip="$emit('skip', offer.version)"
        @unskip="$emit('unskip')"
    />

    <ui-toggle
        v-model="automaticCheck"
        description="On start and once a day. Downloading and installing still wait for you."
        label="Check for updates automatically"
    />
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle, RefreshCw } from '@lucide/vue'
import SettingsUpdateOffer from '@/components/settings/SettingsUpdateOffer.vue'
import UiAge from '@/components/common/time/UiAge.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'
import type { TUpdateOffer } from '@/application/services/update/types/TUpdateOffer'
import type { TUpdatePhase } from '@/store/modules/update/types/TUpdatePhase'

@Component({
  components: { LoaderCircle, RefreshCw, SettingsUpdateOffer, UiAge, UiSection, UiToggle },
  emits: ['check', 'download', 'cancel', 'install', 'skip', 'unskip', 'open-release', 'update:check-for-updates'],
})
export default class SettingsUpdatesSection extends VueBase {
  @Prop({ required: true })
  public readonly currentVersion: string

  @Prop({ required: true })
  public readonly phase: TUpdatePhase

  @Prop({ required: false, default: null })
  public readonly offer?: TUpdateOffer | null

  @Prop({ required: true, type: Number })
  public readonly received: number

  @Prop({ required: true, type: Number })
  public readonly total: number

  @Prop({ required: true, type: Number })
  public readonly checkedAt: number

  @Prop({ required: false, default: '' })
  public readonly checkError?: string

  @Prop({ required: true, type: Boolean })
  public readonly checkForUpdates: boolean

  @Prop({ required: false, default: '' })
  public readonly skippedVersion?: string

  public get automaticCheck(): boolean {
    return this.checkForUpdates
  }

  public set automaticCheck(value: boolean) {
    this.$emit('update:check-for-updates', value)
  }

  public get hasOffer(): boolean {
    return this.phase !== 'idle' && this.phase !== 'upToDate' && this.phase !== 'checking'
  }

  public get checkDisabled(): boolean {
    return this.phase === 'checking' || this.phase === 'downloading' || this.phase === 'installing'
  }

  public get statusText(): string {
    if (this.phase === 'checking') {
      return 'Checking…'
    }
    if (this.phase === 'upToDate') {
      return 'kubiq is up to date'
    }
    if (this.offer && this.hasOffer) {
      return `kubiq ${this.offer.version} is available`
    }

    return 'Not checked yet'
  }
}
</script>
