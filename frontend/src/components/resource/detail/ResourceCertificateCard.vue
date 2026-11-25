<template>
  <dl class="space-y-1.5 py-2 text-xs first:pt-0 last:pb-0">
    <div class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Version</dt>
      <dd class="min-w-0 flex-1 font-mono text-foreground">
        {{ certificate.version }}
        <span v-if="roleLabel" class="ml-1 font-sans text-muted-foreground">· {{ roleLabel }}</span>
      </dd>
    </div>

    <div class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Serial number</dt>
      <dd class="min-w-0 flex-1 break-all font-mono text-foreground">{{ certificate.serialNumber }}</dd>
    </div>

    <div class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Signature algorithm</dt>
      <dd class="min-w-0 flex-1 break-all font-mono text-foreground">{{ certificate.signatureAlgorithm }}</dd>
    </div>

    <div class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Issuer</dt>
      <dd class="min-w-0 flex-1 break-all font-mono text-foreground">{{ certificate.issuer || '—' }}</dd>
    </div>

    <div class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Subject</dt>
      <dd class="min-w-0 flex-1 break-all font-mono text-foreground">{{ certificate.subject || '—' }}</dd>
    </div>

    <div class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Validity</dt>
      <dd class="min-w-0 flex-1 space-y-1">
        <div>
          <ui-status-badge :label="validityLabel" :tone="validityTone" />
        </div>
        <div class="font-mono text-foreground">
          <span class="font-sans text-muted-foreground">Not before: </span>
          {{ notBeforeText }}
          <span v-if="notBeforeRelative" class="font-sans text-muted-foreground">({{ notBeforeRelative }})</span>
        </div>
        <div class="font-mono text-foreground">
          <span class="font-sans text-muted-foreground">Not after: </span>
          {{ notAfterText }}
          <span v-if="notAfterRelative" class="font-sans text-muted-foreground">({{ notAfterRelative }})</span>
        </div>
      </dd>
    </div>

    <div v-if="certificate.subjectAltNames.length > 0" class="flex items-baseline gap-2">
      <dt class="w-32 shrink-0 text-muted-foreground">Subject alternative name</dt>
      <dd class="min-w-0 flex-1">
        <ul class="space-y-0.5 font-mono text-foreground">
          <li v-for="(san, index) in certificate.subjectAltNames" :key="`${san}-${index}`" class="break-all">
            {{ san }}
          </li>
        </ul>
      </dd>
    </div>
  </dl>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { X509CertificateParser, X509ValidityCatalog } from '@/domain/models/certificate'
import type { TX509Certificate } from '@/domain/models/certificate'

@Component({
  components: { UiStatusBadge },
})
export default class ResourceCertificateCard extends VueBase {
  @Prop({ required: true })
  public readonly certificate: TX509Certificate

  public get validityTone(): TUiTone {
    return X509ValidityCatalog.state(this.certificate.validity)
  }

  public get validityLabel(): string {
    return X509ValidityCatalog.label(this.certificate.validity)
  }

  public get notBeforeText(): string {
    return ResourceCertificateCard.formatUtc(this.certificate.notBefore)
  }

  public get notBeforeRelative(): string {
    return X509CertificateParser.formatRelative(this.certificate.notBefore)
  }

  public get notAfterText(): string {
    return ResourceCertificateCard.formatUtc(this.certificate.notAfter)
  }

  public get notAfterRelative(): string {
    return X509CertificateParser.formatRelative(this.certificate.notAfter)
  }

  public get roleLabel(): string {
    if (this.certificate.isCa && this.certificate.isSelfSigned) {
      return 'Root CA'
    }
    if (this.certificate.isCa) {
      return 'Intermediate CA'
    }
    if (this.certificate.isSelfSigned) {
      return 'Self-signed'
    }

    return ''
  }

  private static formatUtc(iso: string): string {
    return iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC').replace(/Z$/, ' UTC')
  }
}
</script>
