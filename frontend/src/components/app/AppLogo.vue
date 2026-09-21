<template>
  <div :aria-label="accessibleLabel" :role="accessibleRole" class="flex items-center gap-2 select-none">
    <app-icon :class="['text-primary shrink-0', iconSizeClass]" />
    <span v-if="!iconOnly" :class="['font-semibold tracking-tight text-foreground', sizeClass]">
      {{ appName }}
    </span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import AppIcon from '@/components/app/AppIcon.vue'
import { AppEnvironment } from '@/config/AppEnvironment'

@Component({
  components: { AppIcon },
})
export default class AppLogo extends VueBase {
  @Prop({ required: false, default: 'md' })
  public readonly size?: 'sm' | 'md' | 'lg'

  @Prop({ required: false, default: false })
  public readonly iconOnly?: boolean

  public get appName(): string {
    return AppEnvironment.AppName
  }

  public get accessibleRole(): string | undefined {
    return this.iconOnly ? 'img' : undefined
  }

  public get accessibleLabel(): string | undefined {
    return this.iconOnly ? this.appName : undefined
  }

  public get iconSizeClass(): string {
    switch (this.size) {
      case 'sm':
        return 'w-7 h-7'
      case 'lg':
        return 'w-12 h-12'
      default:
        return 'w-8 h-8'
    }
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
