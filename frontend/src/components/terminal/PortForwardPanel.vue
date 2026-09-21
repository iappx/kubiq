<template>
  <div :data-density="uiStore.density" class="flex h-full min-h-0 flex-col bg-background">
    <port-forward-form :cluster-id="clusterId" />

    <ui-deferred-loader :loading="portForwardStore.starting">
      <template #loading>
        <ui-progress-bar label="Starting the port forward" />
      </template>
    </ui-deferred-loader>

    <div class="flex-1 min-h-0 overflow-auto">
      <empty-state
          v-if="forwards.length === 0"
          :icon="cableIcon"
          description="Forward a port from a pod or a service and it will be listed here."
          title="No port forwards"
      />

      <port-forward-row
          v-for="forward in forwards"
          :key="forward.forwardId"
          :forward="forward"
          @open="portForwardStore.open($event)"
          @stop="portForwardStore.stop($event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Cable } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import PortForwardForm from '@/components/terminal/PortForwardForm.vue'
import PortForwardRow from '@/components/terminal/PortForwardRow.vue'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { EmptyState, PortForwardForm, PortForwardRow, UiDeferredLoader, UiProgressBar },
})
export default class PortForwardPanel extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
  ) {
    super()
  }

  public get forwards(): TPortForward[] {
    return this.portForwardStore.forwardsOf(this.clusterId)
  }

  public get cableIcon(): VueComponent {
    return Cable
  }
}
</script>
