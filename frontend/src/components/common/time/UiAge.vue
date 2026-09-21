<template>
  <time :datetime="isoValue" :title="absolute" class="tabular">{{ text }}</time>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { DateTime } from 'luxon'
import { UiAgeFormatter } from '@/components/common/time/UiAgeFormatter'
import { UiAgeTicker } from '@/components/common/time/UiAgeTicker'

@Component({})
export default class UiAge extends VueBase {
  @Prop({ required: true })
  public readonly value: string | number | Date | null

  @Prop({ required: false, default: '—' })
  public readonly placeholder?: string

  public now = Date.now()

  private onTick!: () => void

  public get text(): string {
    const at = this.timestamp
    return at === null ? (this.placeholder ?? '') : UiAgeFormatter.format(at, this.now)
  }

  public get absolute(): string | undefined {
    const at = this.timestamp
    return at === null ? undefined : DateTime.fromMillis(at).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
  }

  public get isoValue(): string | undefined {
    const at = this.timestamp
    return at === null ? undefined : new Date(at).toISOString()
  }

  created(): void {
    this.onTick = () => {
      this.now = Date.now()
    }
    UiAgeTicker.subscribe(this.onTick)
  }

  beforeUnmount(): void {
    UiAgeTicker.unsubscribe(this.onTick)
  }

  private get timestamp(): number | null {
    return UiAgeFormatter.parse(this.value)
  }
}
</script>
