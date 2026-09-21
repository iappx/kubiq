<template>
  <app-loading>
    <div class="min-h-screen bg-background flex flex-col">
      <top-nav />
      <div class="flex flex-1 overflow-hidden">
        <sidebar />
        <main class="flex-1 p-6 overflow-auto">
          <router-view />
        </main>
      </div>
    </div>
    <app-modals />
  </app-loading>
</template>

<script lang="ts">
import AppLoading from '@/components/app/AppLoading.vue'
import { Component, VueBase } from '@iappx/vue-facing-di'
import Sidebar from '@/containers/Sidebar.vue'
import TopNav from '@/containers/TopNav.vue'
import AppModals from '@/components/app/AppModals.vue'


@Component({
  components: {
    AppModals,
    Sidebar,
    TopNav,
    AppLoading,
  },
})
export default class AppBase extends VueBase {
}
</script>
