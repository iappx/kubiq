<template>
  <div
    v-if="store.navigating"
    class="fixed top-0 left-0 right-0 h-[4px] z-[150] overflow-hidden bg-primary/20"
  >
    <motion-div
      :animate="{ x: ['-60%', '160%'] }"
      :transition="{ duration: 1.2, repeat: Infinity, ease: 'linear' }"
      class="absolute top-0 left-0 h-full w-3/5 bg-linear-to-r from-transparent via-primary to-transparent"
    />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { RouterNavigationStore } from '@/store/modules/routerNavigation/RouterNavigationStore'
import { motion } from 'motion-v'

@Component({
  components: {
    MotionDiv: motion.div,
  },
})
export default class RouterProgressBar extends VueBase {
  constructor(
    @inject(RouterNavigationStore) public readonly store: RouterNavigationStore,
  ) {
    super()
  }
}
</script>
