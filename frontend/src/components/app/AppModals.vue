<template>
  <div>
    <app-toast />
    <command-palette />
    <port-forward-modal />
    <cluster-customize-modal />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import AppToast from '@/components/app/AppToast.vue'
import ClusterCustomizeModal from '@/components/cluster/customize/ClusterCustomizeModal.vue'
import CommandPalette from '@/components/clusterShell/CommandPalette.vue'
import PortForwardModal from '@/components/terminal/PortForwardModal.vue'

@Component({
  components: { AppToast, ClusterCustomizeModal, CommandPalette, PortForwardModal },
})
export default class AppModals extends VueBase {
}
</script>
