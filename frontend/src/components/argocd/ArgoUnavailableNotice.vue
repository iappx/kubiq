<template>
  <div class="flex flex-1 min-h-0 items-center justify-center p-4">
    <div class="surface max-w-xl p-4 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
          <rocket :size="20" class="text-muted-foreground" />
        </div>
        <div class="min-w-0 space-y-1">
          <h2 class="text-base font-medium text-foreground">Argo CD is not installed here</h2>
          <p class="text-sm text-muted-foreground">{{ clusterId }} serves no Application resource.</p>
        </div>
      </div>

      <p class="text-sm text-muted-foreground">
        Kubiq drives Argo CD through its own custom resources, so this screen appears once
        <code class="text-foreground">applications.argoproj.io</code> is served and you are allowed to list it.
        Nothing else has to be installed on this machine.
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <button :disabled="checking" class="btn-primary" type="button" @click="$emit('retry')">
          <refresh-cw :class="checking ? 'animate-spin' : ''" :size="14" />
          Check again
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { RefreshCw, Rocket } from '@lucide/vue'

@Component({
  components: { RefreshCw, Rocket },
  emits: ['retry'],
})
export default class ArgoUnavailableNotice extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: false })
  public readonly checking?: boolean
}
</script>
