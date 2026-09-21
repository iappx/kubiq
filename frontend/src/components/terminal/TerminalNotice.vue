<template>
  <div v-if="visible" :class="['terminal-notice', toneClass]">
    <ui-status-badge :label="headline" :tone="tone" />

    <p v-if="detail" class="truncate text-xs text-muted-foreground">{{ detail }}</p>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <button
          v-if="hint === 'kubectl'"
          class="btn-secondary h-7 px-2 text-xs"
          type="button"
          @click="$emit('install')"
      >
        <external-link :size="12" />
        <span>Installation guide</span>
      </button>

      <button class="btn-secondary h-7 px-2 text-xs" type="button" @click="$emit('restart')">
        <rotate-cw :size="12" />
        <span>Restart</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ExternalLink, RotateCw } from '@lucide/vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { TerminalTools } from '@/application/services/terminal/constants/TerminalTools'
import type { TTerminalHint, TTerminalState } from '@/domain/models/terminal'

@Component({
  components: { ExternalLink, RotateCw, UiStatusBadge },
  emits: ['restart', 'install'],
})
export default class TerminalNotice extends VueBase {
  @Prop({ required: true })
  public readonly state: TTerminalState

  @Prop({ required: true })
  public readonly hint: TTerminalHint

  @Prop({ required: false, default: '' })
  public readonly failure?: string

  public get visible(): boolean {
    return this.state === 'failed' || this.state === 'ended'
  }

  public get tone(): TUiTone {
    return this.state === 'failed' ? 'error' : 'unknown'
  }

  public get toneClass(): string {
    return this.state === 'failed' ? 'terminal-notice-error' : ''
  }

  public get headline(): string {
    if (this.state === 'ended') {
      return 'Session ended'
    }

    switch (this.hint) {
      case 'kubectl':
        return TerminalTools.kubectlMissing
      case 'unsupported':
        return 'This cluster cannot open a shell'
      case 'desktop':
        return 'Not available in this window'
      default:
        return 'Session failed'
    }
  }

  public get detail(): string {
    return this.hint === 'kubectl' ? TerminalTools.kubectlHelp : this.failure ?? ''
  }
}
</script>

<style scoped>
.terminal-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding-inline: 12px;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 0.5);
  font-size: 12px;
}

.terminal-notice-error {
  background-color: hsl(var(--destructive) / 0.1);
  border-bottom-color: hsl(var(--destructive) / 0.3);
}
</style>
