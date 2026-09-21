<template>
  <div class="ui-diff" role="group" :aria-label="label">
    <div
        v-for="(line, index) in lines"
        :key="`${index}-${line.leftNumber}-${line.rightNumber}`"
        :class="['ui-diff-line', `ui-diff-${line.kind}`]"
    >
      <span class="ui-diff-gutter tabular">{{ line.kind === 'gap' ? '' : line.leftNumber || '' }}</span>
      <span class="ui-diff-gutter tabular">{{ line.kind === 'gap' ? '' : line.rightNumber || '' }}</span>
      <span class="ui-diff-sign" aria-hidden="true">{{ signOf(line) }}</span>
      <span class="ui-diff-text">{{ line.kind === 'gap' ? '⋯' : line.text }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import type { TYamlDiffLine } from '@/application/services/resourceYaml/types/TYamlDiffLine'

@Component({})
export default class ResourceDiffView extends VueBase {
  @Prop({ required: true })
  public readonly lines: TYamlDiffLine[]

  @Prop({ required: true })
  public readonly label: string

  public signOf(line: TYamlDiffLine): string {
    if (line.kind === 'added') {
      return '+'
    }

    return line.kind === 'removed' ? '-' : ' '
  }
}
</script>
