<template>
  <span
      :aria-hidden="label ? undefined : 'true'"
      :aria-label="label || undefined"
      :class="classes"
      :role="label ? 'img' : undefined"
  >
    <img v-if="showsImage" :src="icon.imageUrl" alt="" draggable="false">
    <component :is="glyph" v-else-if="showsGlyph" :size="glyphSize" aria-hidden="true" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ClusterGlyphResolver } from '@/components/cluster/ClusterGlyphResolver'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterAvatarSize } from '@/components/cluster/types/TClusterAvatarSize'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'

@Component({})
export default class ClusterAvatar extends VueBase {
  private static readonly glyphSizes: Record<TClusterAvatarSize, number> = { sm: 12, md: 16, lg: 30 }

  private static readonly denseAfter: number = 2

  @Prop({ required: true })
  public readonly icon: TClusterIcon

  @Prop({ required: false, default: 'md' })
  public readonly size?: TClusterAvatarSize

  @Prop({ required: false, default: '' })
  public readonly label?: string

  public get showsImage(): boolean {
    return this.icon.kind === 'image' && this.icon.imageUrl !== ''
  }

  public get showsGlyph(): boolean {
    return this.icon.kind === 'glyph'
  }

  public get initials(): string {
    return this.icon.initials || ClusterMonogram.placeholder
  }

  public get glyph(): VueComponent {
    return ClusterGlyphResolver.resolve(this.icon.glyph)
  }

  public get glyphSize(): number {
    return ClusterAvatar.glyphSizes[this.size ?? 'md'] ?? ClusterAvatar.glyphSizes.md
  }

  public get classes(): string[] {
    const classes = ['cluster-avatar', `cluster-avatar-${this.size ?? 'md'}`]

    if (this.showsImage) {
      return [...classes, 'cluster-avatar-image']
    }

    classes.push(`cluster-avatar-${this.icon.color}`)

    if (!this.showsGlyph && Array.from(this.initials).length > ClusterAvatar.denseAfter) {
      classes.push('cluster-avatar-dense')
    }

    return classes
  }
}
</script>
