<template>
  <div class="flex items-center gap-2 select-none">
    <div class="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
      <span class="font-bold text-primary-foreground text-base">{{ initial }}</span>
    </div>
    <span v-if="!iconOnly" :class="['font-semibold tracking-tight text-foreground', sizeClass]">
      {{ appName }}
    </span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { AppEnvironment } from '@/config/AppEnvironment'

@Component({})
export default class AppLogo extends VueBase {
  @Prop({ required: false, default: 'md' })
  public readonly size?: 'sm' | 'md' | 'lg'

  @Prop({ required: false, default: false })
  public readonly iconOnly?: boolean

  public get appName(): string {
    return AppEnvironment.AppName
  }

  public get initial(): string {
    return this.appName.charAt(0).toUpperCase()
  }

  public get sizeClass(): string {
    switch (this.size) {
      case 'sm':
        return 'text-sm'
      case 'lg':
        return 'text-lg'
      default:
        return 'text-base'
    }
  }
}
</script>
