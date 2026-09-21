<template>
  <ul v-if="keys.length > 0" class="space-y-1">
    <li v-for="key in keys" :key="key" class="flex items-baseline gap-2 text-xs">
      <span class="min-w-0 shrink-0 max-w-40 truncate font-medium text-foreground" :title="key">{{ key }}</span>
      <span class="min-w-0 flex-1 break-all text-muted-foreground">{{ pairs[key] }}</span>
    </li>
  </ul>

  <p v-else class="text-xs text-muted-foreground">{{ emptyLabel }}</p>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class ResourceKeyValueList extends VueBase {
  @Prop({ required: true })
  public readonly pairs: Record<string, string>

  @Prop({ required: false, default: 'None' })
  public readonly emptyLabel?: string

  public get keys(): string[] {
    return Object.keys(this.pairs).sort((a, b) => a.localeCompare(b))
  }
}
</script>
