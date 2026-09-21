<template>
  <div :class="['pod-log-row', wrap ? 'pod-log-row-wrap' : '']" :style="{ minHeight: `${height}px`, lineHeight: `${height}px` }">
    <span v-if="prefix" class="pod-log-prefix">{{ prefix }}</span><span
        v-for="(cell, index) in cells"
        :key="index"
        :class="classOf(cell)"
        :style="styleOf(cell)"
    >{{ cell.text }}</span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { PodLogAnsi } from '@/components/logs/PodLogAnsi'
import { PodLogHighlighter } from '@/components/logs/PodLogHighlighter'
import type { TPodLogCell } from '@/components/logs/types/TPodLogCell'
import type { TPodLogRun } from '@/components/logs/types/TPodLogRun'

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

  public get cells(): TPodLogCell[] {
    const runs = PodLogAnsi.runs(this.text)
    const stamp = this.timestamps === true ? PodLogRow.stampOf(runs) : null
    if (stamp === null) {
      return runs.flatMap(run => this.expand(run, false))
    }

    return [
      ...this.expand(stamp, true),
      ...PodLogRow.afterStamp(runs, stamp.text.length).flatMap(run => this.expand(run, false)),
    ]
  }

  public classOf(cell: TPodLogCell): string {
    if (cell.match) {
      return 'pod-log-match'
    }

    return cell.stamp ? 'pod-log-stamp' : ''
  }

  public styleOf(cell: TPodLogCell): Record<string, string> {
    const style: Record<string, string> = {}

    if (cell.style.color !== '') {
      style.color = cell.style.color
    }
    if (cell.style.background !== '') {
      style.backgroundColor = cell.style.background
    }
    if (cell.style.bold) {
      style.fontWeight = '600'
    }
    if (cell.style.dim) {
      style.opacity = '0.65'
    }
    if (cell.style.italic) {
      style.fontStyle = 'italic'
    }
    if (cell.style.underline) {
      style.textDecoration = 'underline'
    }

    return style
  }

  private expand(run: TPodLogRun, stamp: boolean): TPodLogCell[] {
    return PodLogHighlighter
        .segments(run.text, this.query ?? '')
        .map(segment => ({ text: segment.text, match: segment.match, stamp, style: run.style }))
  }

  // The cluster writes the timestamp ahead of anything the container emits, so it always
  // sits in the first run and ends at the first space in it.
  private static stampOf(runs: readonly TPodLogRun[]): TPodLogRun | null {
    const head = runs[0]
    if (!head) {
      return null
    }

    const at = head.text.indexOf(' ')

    return at === -1 ? null : { text: head.text.slice(0, at + 1), style: head.style }
  }

  private static afterStamp(runs: readonly TPodLogRun[], length: number): TPodLogRun[] {
    const head = runs[0]
    const rest = runs.slice(1)

    return head.text.length === length ? rest : [{ text: head.text.slice(length), style: head.style }, ...rest]
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
