<template>
  <resource-section :hint="secretName" title="Certificate">
    <ul v-if="secretRelation" class="space-y-1">
      <resource-related-row :object="secretRelation" @open="$emit('open', $event)" />
    </ul>

    <ui-deferred-loader :loading="loading">
      <template #loading>
        <p class="text-xs text-muted-foreground">Reading certificate from Secret…</p>
      </template>

      <div v-if="tlsChain || caChain" class="space-y-3">
        <div v-if="tlsChain" class="space-y-2 rounded border border-border px-3 py-2">
          <div class="font-mono text-xs font-medium text-foreground">tls.crt</div>
          <resource-certificate-chain :chain="tlsChain" />
        </div>

        <div v-if="caChain" class="space-y-2 rounded border border-border px-3 py-2">
          <div class="font-mono text-xs font-medium text-foreground">ca.crt</div>
          <resource-certificate-chain :chain="caChain" />
        </div>
      </div>

      <p v-else-if="notice" class="text-xs text-muted-foreground">{{ notice }}</p>
    </ui-deferred-loader>
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import ResourceCertificateChain from '@/components/resource/detail/ResourceCertificateChain.vue'
import ResourceRelatedRow from '@/components/resource/detail/ResourceRelatedRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { KubeDataMapReader } from '@/domain/entities/config'
import type { TKubeDataMap } from '@/domain/entities/config'
import { ApiError } from '@/domain/errors/ApiError'
import { X509CertificateParser } from '@/domain/models/certificate'
import type { TX509Chain } from '@/domain/models/certificate'
import { KubeClusterCatalog, KubeManifest, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { ResourceCertificateChain, ResourceRelatedRow, ResourceSection, UiDeferredLoader },
  emits: ['open'],
})
export default class ResourceCertManagerSection extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  public loading = false

  public tlsChain: TX509Chain | null = null

  public caChain: TX509Chain | null = null

  public notice = ''

  private loadToken = 0

  constructor(
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ResourceYamlService) private readonly yamlService: ResourceYamlService,
  ) {
    super()
  }

  public get secretName(): string {
    const spec = KubeManifest.isObject(this.state.object.spec) ? this.state.object.spec : null

    return spec && typeof spec.secretName === 'string' ? spec.secretName.trim() : ''
  }

  public get namespace(): string {
    return this.target.namespace || KubeManifest.namespaceOf(this.state.object)
  }

  public get secretKind(): KubeResourceKind | null {
    const served = this.discoveryStore.kindsOf(this.target.clusterId)

    return served.find(kind => KubeClusterCatalog.isSecret(kind))
      ?? KubeResourceRegistry.find('', 'secrets')
      ?? null
  }

  public get secretRelation(): TRelatedObject | null {
    if (!this.secretName) {
      return null
    }

    return {
      key: `secret/${this.namespace}/${this.secretName}`,
      kindName: 'Secret',
      name: this.secretName,
      namespace: this.namespace,
      kind: this.secretKind,
      detail: '',
    }
  }

  public get watchKey(): string {
    return `${this.target.clusterId}/${this.namespace}/${this.secretName}`
  }

  async created(): Promise<void> {
    await this.reload()
  }

  @Watch('watchKey')
  async watchKeyChanged(): Promise<void> {
    await this.reload()
  }

  private async reload(): Promise<void> {
    const token = ++this.loadToken
    this.tlsChain = null
    this.caChain = null
    this.notice = ''

    if (!this.secretName) {
      this.loading = false
      this.notice = 'This Certificate does not specify spec.secretName.'
      return
    }

    const kind = this.secretKind
    if (!kind) {
      this.loading = false
      this.notice = 'Secret resource kind is not available in this cluster.'
      return
    }

    this.loading = true
    try {
      const secret = await this.yamlService.read({
        clusterId: this.target.clusterId,
        kind,
        name: this.secretName,
        namespace: this.namespace,
      })

      if (token !== this.loadToken) {
        return
      }

      const data = KubeManifest.isObject(secret.data) ? secret.data as TKubeDataMap : undefined
      const tlsPem = KubeDataMapReader.decode(data, 'tls.crt')
      const caPem = KubeDataMapReader.decode(data, 'ca.crt')

      this.tlsChain = tlsPem ? X509CertificateParser.parsePem(tlsPem) : null
      this.caChain = caPem ? X509CertificateParser.parsePem(caPem) : null

      if (!this.tlsChain && !this.caChain) {
        this.notice = `Secret "${this.secretName}" does not contain a readable X.509 certificate.`
      }
    } catch (err) {
      if (token !== this.loadToken) {
        return
      }

      this.notice = err instanceof ApiError
        ? `Could not read Secret "${this.secretName}": ${err.message}`
        : `Could not read Secret "${this.secretName}".`
    } finally {
      if (token === this.loadToken) {
        this.loading = false
      }
    }
  }
}
</script>
