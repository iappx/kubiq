<template>
  <div class="flex items-center gap-2 border-b border-border px-4 py-2">
    <span class="shrink-0 text-xs text-muted-foreground">Scope</span>

    <label class="sr-only" for="event-scope-type">Event type</label>
    <select
        id="event-scope-type"
        :value="scope.type"
        class="ui-input h-7 w-36 shrink-0 py-0 text-xs"
        @change="setType($event)"
    >
      <option value="">All types</option>
      <option v-for="type in types" :key="type" :value="type">{{ titleOf(type) }}</option>
    </select>

    <label class="sr-only" for="event-scope-kind">Object kind</label>
    <input
        id="event-scope-kind"
        :value="scope.objectKind"
        autocomplete="off"
        class="ui-input h-7 w-36 shrink-0 py-0 text-xs"
        placeholder="Kind, e.g. Pod"
        spellcheck="false"
        type="text"
        @change="setObjectKind($event)"
    >

    <label class="sr-only" for="event-scope-name">Object name</label>
    <input
        id="event-scope-name"
        :value="scope.objectName"
        autocomplete="off"
        class="ui-input h-7 w-48 shrink-0 py-0 text-xs"
        placeholder="Object name"
        spellcheck="false"
        type="text"
        @change="setObjectName($event)"
    >

    <button
        v-if="isScoped"
        class="btn-secondary h-7 shrink-0 px-2 py-0 text-xs"
        type="button"
        @click="clear"
    >
      Clear scope
    </button>

    <span class="min-w-0 truncate text-xs text-muted-foreground">
      {{ hint }}
    </span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { EventFilters, EventTypeCatalog } from '@/domain/entities/cluster'
import type { TEventScope, TEventType } from '@/domain/entities/cluster'

@Component({
  emits: ['update:scope'],
})
export default class EventScopeBar extends VueBase {
  @Prop({ required: true })
  public readonly scope: TEventScope

  public get types(): TEventType[] {
    return Object.keys(EventTypeCatalog.values) as TEventType[]
  }

  public get isScoped(): boolean {
    return EventFilters.isScoped(this.scope)
  }

  public get hint(): string {
    return this.isScoped
      ? 'The cluster answers with the matching events only.'
      : 'Narrow by type or by the object an event is about.'
  }

  public titleOf(type: TEventType): string {
    return EventTypeCatalog.title(type)
  }

  public setType(event: Event): void {
    const value = EventScopeBar.valueOf(event)

    this.emit({ ...this.scope, type: EventTypeCatalog.has(value) ? value as TEventType : '' })
  }

  public setObjectKind(event: Event): void {
    this.emit({ ...this.scope, objectKind: EventScopeBar.valueOf(event).trim() })
  }

  public setObjectName(event: Event): void {
    this.emit({ ...this.scope, objectName: EventScopeBar.valueOf(event).trim() })
  }

  public clear(): void {
    this.emit({ type: '', objectKind: '', objectName: '' })
  }

  private emit(scope: TEventScope): void {
    this.$emit('update:scope', scope)
  }

  private static valueOf(event: Event): string {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null

    return target ? target.value : ''
  }
}
</script>
