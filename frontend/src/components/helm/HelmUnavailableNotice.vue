<template>
  <div class="flex flex-1 min-h-0 items-center justify-center p-4">
    <div class="surface max-w-xl p-4 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
          <package :size="20" class="text-muted-foreground" />
        </div>
        <div class="min-w-0 space-y-1">
          <h2 class="text-base font-medium text-foreground">Helm is not available</h2>
          <p class="text-sm text-muted-foreground">{{ reason }}</p>
        </div>
      </div>

      <p class="text-sm text-muted-foreground">
        Kubiq drives the <code class="text-foreground">helm</code> executable installed on this machine and ships
        none of its own. Install Helm, or point kubiq at it in Settings, then check again. Everything else in the
        application keeps working without it.
      </p>

      <pre v-if="detail" class="max-h-40 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">{{ detail }}</pre>

      <div class="flex flex-wrap items-center gap-2">
        <button :disabled="checking" class="btn-primary" type="button" @click="$emit('retry')">
          <refresh-cw :class="checking ? 'animate-spin' : ''" :size="14" />
          Check again
        </button>

        <button class="btn-secondary" type="button" @click="$emit('install')">
          <external-link :size="14" />
          How to install Helm
        </button>

        <router-link class="btn-secondary" to="/app/settings">
          <settings :size="14" />
          Settings
        </router-link>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ExternalLink, Package, RefreshCw, Settings } from '@lucide/vue'

@Component({
  components: { ExternalLink, Package, RefreshCw, Settings },
  emits: ['retry', 'install'],
})
export default class HelmUnavailableNotice extends VueBase {
  @Prop({ required: true })
  public readonly reason: string

  @Prop({ required: false, default: '' })
  public readonly detail?: string

  @Prop({ required: false, default: false })
  public readonly checking?: boolean
}
</script>
