<template>
  <div class="space-y-4">
    <ui-error-state
        v-if="state.environmentError"
        :message="state.environmentError"
        title="Could not read the environment"
        @retry="reload"
    />

    <ui-deferred-loader v-else-if="pending" :loading="true">
      <template #loading>
        <resource-environment-skeleton />
      </template>
    </ui-deferred-loader>

    <template v-else>
      <p v-if="fromTemplate" class="text-xs text-muted-foreground">
        This is the pod template's environment — what each pod is given when it starts, not what a
        running container currently holds.
      </p>

      <p v-if="carriesSecret" class="text-xs text-muted-foreground">
        A value that came from a Secret is masked until you reveal it, and is not on the page at all
        until then — a revealed value is shown on screen only, never written to a log or a file.
      </p>

      <p v-if="groups.length === 0" class="text-xs text-muted-foreground">{{ emptyMessage }}</p>

      <resource-environment-group
          v-for="group in groups"
          :key="group.container"
          :group="group"
          @copy-entry="copyEntry"
          @copy-group="copyGroup"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import ResourceEnvironmentGroup from '@/components/resource/detail/ResourceEnvironmentGroup.vue'
import ResourceEnvironmentSkeleton from '@/components/resource/detail/ResourceEnvironmentSkeleton.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import { PodEnvironmentText } from '@/application/services/podEnvironment/models/PodEnvironmentText'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'
import { KubeWorkloadCatalog } from '@/domain/models/kube'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: {
    ResourceEnvironmentGroup,
    ResourceEnvironmentSkeleton,
    UiDeferredLoader,
    UiErrorState,
  },
})
export default class ResourceEnvironmentTab extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  constructor(
      @inject(ResourceObjectStore) private readonly objectStore: ResourceObjectStore,
  ) {
    super()
  }

  public get groups(): TPodEnvironmentGroup[] {
    return this.state.environment
  }

  // A reload keeps what is already on screen; only an empty tab gets the skeleton.
  public get pending(): boolean {
    return this.groups.length === 0 && (this.state.environmentLoading || !this.state.environmentLoaded)
  }

  public get carriesSecret(): boolean {
    return this.groups.some(group => PodEnvironmentText.hidesSecret(group))
  }

  public get fromTemplate(): boolean {
    return !KubeWorkloadCatalog.isPod(this.target.kind)
  }

  public get emptyMessage(): string {
    return this.fromTemplate
      ? `This ${this.target.kind.kind} carries a pod template with no containers.`
      : 'This pod declares no containers.'
  }

  public reload(): Promise<void> {
    return this.objectStore.loadEnvironment(this.target)
  }

  public copyEntry(id: string): void {
    void this.objectStore.copyEnvironmentEntry(this.target, id)
  }

  public copyGroup(container: string): void {
    void this.objectStore.copyEnvironmentGroup(this.target, container)
  }
}
</script>
