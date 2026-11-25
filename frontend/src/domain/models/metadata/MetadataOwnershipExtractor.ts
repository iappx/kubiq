import type { TMetadataOwnershipBadge } from '@/domain/models/metadata/types/TMetadataOwnershipBadge'

export class MetadataOwnershipExtractor {
    public static extract(
        labels: Record<string, string>,
        annotations: Record<string, string>,
        namespace: string
    ): TMetadataOwnershipBadge[] {
        const badges: TMetadataOwnershipBadge[] = []

        const helmBadge = MetadataOwnershipExtractor.extractHelm(labels, annotations, namespace)
        if (helmBadge) {
            badges.push(helmBadge)
        }

        const argoBadge = MetadataOwnershipExtractor.extractArgoCd(labels, annotations)
        if (argoBadge) {
            badges.push(argoBadge)
        }

        const appBadge = MetadataOwnershipExtractor.extractApp(labels)
        if (appBadge) {
            badges.push(appBadge)
        }

        const prometheusBadge = MetadataOwnershipExtractor.extractPrometheus(annotations)
        if (prometheusBadge) {
            badges.push(prometheusBadge)
        }

        return badges
    }

    private static extractHelm(
        labels: Record<string, string>,
        annotations: Record<string, string>,
        namespace: string
    ): TMetadataOwnershipBadge | null {
        const annotationRelease = (annotations['meta.helm.sh/release-name'] ?? '').trim()
        const managedBy = (labels['app.kubernetes.io/managed-by'] ?? '').trim()
        const instanceLabel = (labels['app.kubernetes.io/instance'] ?? '').trim()
        const chartLabel = (labels['helm.sh/chart'] ?? '').trim()

        const hasHelmMarker =
            annotationRelease.length > 0 ||
            (managedBy === 'Helm' && (instanceLabel.length > 0 || chartLabel.length > 0))

        if (!hasHelmMarker) {
            return null
        }

        const releaseName = annotationRelease || instanceLabel
        const annotationNamespace = (annotations['meta.helm.sh/release-namespace'] ?? '').trim()
        const releaseNamespace = annotationNamespace || namespace

        const detailParts: string[] = []
        if (releaseName) {
            if (annotationNamespace && annotationNamespace !== namespace) {
                detailParts.push(`${releaseName} (${annotationNamespace})`)
            } else {
                detailParts.push(releaseName)
            }
        }
        if (chartLabel) {
            detailParts.push(chartLabel)
        }

        return {
            provider: 'helm',
            label: 'Helm',
            detail: detailParts.join(' · '),
            reference: {
                kindName: 'HelmRelease',
                apiVersion: '',
                name: releaseName || chartLabel,
                namespace: releaseNamespace,
                routeKind: 'helm',
            },
        }
    }

    private static extractArgoCd(
        labels: Record<string, string>,
        annotations: Record<string, string>
    ): TMetadataOwnershipBadge | null {
        const trackingId = (annotations['argocd.argoproj.io/tracking-id'] ?? '').trim()
        const trackingApp = trackingId ? trackingId.split(':')[0].trim() : ''
        const instanceApp = (labels['argocd.argoproj.io/instance'] ?? '').trim()
        const appName = trackingApp || instanceApp

        if (!appName) {
            return null
        }

        return {
            provider: 'argocd',
            label: 'ArgoCD',
            detail: appName,
            reference: {
                kindName: 'Application',
                apiVersion: 'argoproj.io/v1alpha1',
                name: appName,
                namespace: '',
                routeKind: 'argocd',
            },
        }
    }

    private static extractApp(labels: Record<string, string>): TMetadataOwnershipBadge | null {
        const partOf = (labels['app.kubernetes.io/part-of'] ?? '').trim()
        const appName = partOf || (labels['app.kubernetes.io/name'] ?? '').trim()

        if (!appName) {
            return null
        }

        const version = (labels['app.kubernetes.io/version'] ?? '').trim()
        const detail = version ? `${appName} · ${version}` : appName

        return {
            provider: 'k8s-app',
            label: 'App',
            detail,
        }
    }

    private static extractPrometheus(annotations: Record<string, string>): TMetadataOwnershipBadge | null {
        const scrape = (annotations['prometheus.io/scrape'] ?? '').trim().toLowerCase()
        if (scrape !== 'true') {
            return null
        }

        const port = (annotations['prometheus.io/port'] ?? '').trim()
        const rawPath = (annotations['prometheus.io/path'] ?? '').trim()
        const path = rawPath ? (rawPath.startsWith('/') ? rawPath : `/${rawPath}`) : ''

        let detail = 'enabled'
        if (port && path) {
            detail = `:${port}${path}`
        } else if (port) {
            detail = `:${port}`
        } else if (path) {
            detail = path
        }

        return {
            provider: 'prometheus',
            label: 'Prometheus',
            detail,
        }
    }
}
