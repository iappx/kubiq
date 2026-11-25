<template>
  <ui-modal
      :loading="busy"
      :open="open"
      :title="title"
      submit-label="Start debug shell"
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        {{ description }}
      </p>

      <p v-if="error" class="text-xs text-destructive" role="alert">
        {{ error }}
      </p>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="imageError" label="Debug image">
        <input
            :id="fieldId"
            v-model="image"
            :aria-describedby="describedBy"
            :aria-invalid="imageError ? 'true' : undefined"
            :disabled="busy"
            autocomplete="off"
            class="ui-input font-mono text-xs"
            placeholder="docker.io/library/alpine:3.20"
            spellcheck="false"
            type="text"
            @keydown.enter.prevent="submit"
        >
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId }" label="Target container">
        <select
            :id="fieldId"
            v-model="targetContainerName"
            :disabled="busy"
            class="ui-input"
        >
          <option value="">None (pod network only)</option>
          <option v-for="container in containers" :key="container" :value="container">
            {{ container }}
          </option>
        </select>
      </ui-form-field>
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'

@Component({
  components: { UiFormField, UiModal },
  emits: ['start', 'cancel'],
})
export default class PodDebugDialog extends VueBase {
  @Prop({ required: true, type: Boolean })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly podName: string

  @Prop({ required: true })
  public readonly namespace: string

  @Prop({ required: true })
  public readonly defaultImage: string

  @Prop({ required: true })
  public readonly containers: string[]

  @Prop({ required: false, type: Boolean, default: false })
  public readonly busy?: boolean

  @Prop({ required: false, default: '' })
  public readonly error?: string

  public image = ''

  public targetContainerName = ''

  public imageError = ''

  public get title(): string {
    return `Debug ${this.podName || 'pod'}`.trim()
  }

  public get description(): string {
    const scope = this.namespace ? `${this.namespace}/${this.podName}` : this.podName

    return `Attach an ephemeral debug container to ${scope}. `
        + 'Choose a target container to share its process namespace, or leave it empty for pod network access only.'
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.reset()
    }
  }

  @Watch('defaultImage')
  defaultImageChanged(next: string): void {
    if (this.open && this.image.trim() === '') {
      this.image = next
    }
  }

  @Watch('containers')
  containersChanged(next: string[]): void {
    if (this.targetContainerName !== '' && !next.includes(this.targetContainerName)) {
      this.targetContainerName = ''
    }
  }

  public submit(): void {
    const image = this.image.trim()
    if (image === '') {
      this.imageError = 'Enter a debug container image'
      return
    }

    this.imageError = ''
    this.$emit('start', {
      image,
      targetContainerName: this.targetContainerName,
    })
  }

  private reset(): void {
    this.image = this.defaultImage
    this.targetContainerName = ''
    this.imageError = ''
  }
}
</script>
