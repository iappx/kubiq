<template>
  <div class="min-h-0">
    <p v-if="revisions.length === 0" class="text-xs text-muted-foreground">
      Helm keeps no history for this release.
    </p>

    <ul v-else class="divide-y divide-border">
      <helm-revision-row
          v-for="revision in revisions"
          :key="revision.id"
          :busy="busy"
          :is-current="revision.revision === currentRevision"
          :revision="revision"
          @rollback="$emit('rollback', $event)"
      />
    </ul>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import HelmRevisionRow from '@/components/helm/detail/HelmRevisionRow.vue'
import type { HelmRevisionEntity } from '@/domain/entities/helm/HelmRevisionEntity'

@Component({
  components: { HelmRevisionRow },
  emits: ['rollback'],
})
export default class HelmReleaseHistoryTab extends VueBase {
  @Prop({ required: true })
  public readonly revisions: HelmRevisionEntity[]

  @Prop({ required: true })
  public readonly currentRevision: number

  @Prop({ required: false, default: false })
  public readonly busy?: boolean
}
</script>
