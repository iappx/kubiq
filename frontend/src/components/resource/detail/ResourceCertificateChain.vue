<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="tabular text-muted-foreground">{{ summaryLabel }}</span>
      <ui-status-badge :label="overallLabel" :tone="overallTone" />
    </div>

    <div
        v-if="chain.missingIssuerChain"
        class="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning"
    >
      <ui-status-dot class="mt-0.5 shrink-0" label="Warning" tone="warning" />
      <span>Leaf certificate only — intermediate or root CA certificates are not present in this bundle.</span>
    </div>

    <div class="divide-y divide-border">
      <resource-certificate-card
          v-for="(cert, index) in chain.certificates"
          :key="`${cert.serialNumber}-${index}`"
          :certificate="cert"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import ResourceCertificateCard from '@/components/resource/detail/ResourceCertificateCard.vue'
import { X509ValidityCatalog } from '@/domain/models/certificate'
import type { TX509Chain } from '@/domain/models/certificate'

@Component({
  components: { ResourceCertificateCard, UiStatusBadge, UiStatusDot },
})
export default class ResourceCertificateChain extends VueBase {
  @Prop({ required: true })
  public readonly chain: TX509Chain

  public get summaryLabel(): string {
    const count = this.chain.certificates.length

    return count === 1 ? '1 certificate' : `${count} certificates in chain`
  }

  public get overallTone(): TUiTone {
    return X509ValidityCatalog.state(this.chain.worstValidity)
  }

  public get overallLabel(): string {
    return X509ValidityCatalog.label(this.chain.worstValidity)
  }
}
</script>
