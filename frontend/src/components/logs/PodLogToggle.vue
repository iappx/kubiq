<template>
  <button
      :aria-label="label"
      :aria-pressed="pressed"
      :class="['pod-log-toggle', pressed ? 'pod-log-toggle-on' : '']"
      :title="label"
      type="button"
      @click="$emit('toggle', !pressed)"
  >
    <component :is="icon" :size="14" aria-hidden="true" />
  </button>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import type { Component as VueComponent } from 'vue'

@Component({
  emits: ['toggle'],
})
export default class PodLogToggle extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly icon: VueComponent

  @Prop({ required: true })
  public readonly pressed: boolean
}
</script>

<style scoped>
.pod-log-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  color: hsl(var(--muted-foreground));
  transition: background-color var(--motion-instant) var(--ease-standard),
              color var(--motion-instant) var(--ease-standard);
}

.pod-log-toggle:hover {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.pod-log-toggle-on {
  background-color: hsl(var(--primary) / 0.12);
  border-color: hsl(var(--primary) / 0.28);
  color: hsl(var(--primary));
}
</style>
