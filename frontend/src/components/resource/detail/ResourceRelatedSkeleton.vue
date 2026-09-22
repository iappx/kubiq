<template>
  <div aria-hidden="true" class="space-y-2">
    <div class="h-3 w-24 rounded shimmer" />

    <div class="space-y-1">
      <div v-for="row in 2" :key="row" class="h-7 rounded-md shimmer" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class ResourceRelatedSkeleton extends VueBase {
}
</script>
