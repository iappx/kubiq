<template>
  <div aria-hidden="true" class="space-y-2">
    <div class="h-3 w-32 rounded shimmer" />

    <div class="space-y-2">
      <div v-for="row in 5" :key="row" class="h-12 rounded-md shimmer" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class ResourceEnvironmentSkeleton extends VueBase {
}
</script>
