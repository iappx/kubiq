<template>
  <div :class="['pod-log-row', wrap ? 'pod-log-row-wrap' : '']" :style="{ minHeight: `${height}px`, lineHeight: `${height}px` }">
    <span v-if="prefix" class="pod-log-prefix">{{ prefix }}</span><span
        v-for="(segment, index) in stampSegments"
        :key="`s${index}`"
        :class="segment.match ? 'pod-log-match' : 'pod-log-stamp'"
    >{{ segment.text }}</span><span
        v-for="(segment, index) in bodySegments"
        :key="`b${index}`"
        :class="segment.match ? 'pod-log-match' : ''"
    >{{ segment.text }}</span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { PodLogHighlighter } from '@/components/logs/PodLogHighlighter'
import type { TPodLogSegment } from '@/components/logs/types/TPodLogSegment'

@Component({})
export default class PodLogRow extends VueBase {
  @Prop({ required: true })
  public readonly text: string

  @Prop({ required: true })
  public readonly height: number

  @Prop({ required: false, default: '' })
  public readonly query?: string

  @Prop({ required: false, default: '' })
  public readonly prefix?: string

  @Prop({ required: false, default: false })
  public readonly timestamps?: boolean

  @Prop({ required: false, default: false })
  public readonly wrap?: boolean

  public get stamp(): string {
    if (!this.timestamps) {
      return ''
    }

    const separator = this.text.indexOf(' ')

    return separator === -1 ? '' : this.text.slice(0, separator + 1)
  }

  public get stampSegments(): TPodLogSegment[] {
    return this.stamp === '' ? [] : PodLogHighlighter.segments(this.stamp, this.query ?? '')
  }

  public get bodySegments(): TPodLogSegment[] {
    return PodLogHighlighter.segments(this.text.slice(this.stamp.length), this.query ?? '')
  }
}
</script>

<style scoped>
.pod-log-row {
  white-space: pre;
  padding-inline: 12px;
  color: hsl(var(--foreground));
}

.pod-log-row-wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pod-log-prefix {
  color: hsl(var(--muted-foreground));
  padding-right: 8px;
}

.pod-log-stamp {
  color: hsl(var(--muted-foreground));
}

.pod-log-match {
  background-color: hsl(var(--accent) / 0.28);
  color: hsl(var(--foreground));
  border-radius: 2px;
}
</style>
