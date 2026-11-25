import { describe, expect, it } from 'vitest'
import { MetadataOwnershipExtractor } from '@/domain/models/metadata/MetadataOwnershipExtractor'

describe('MetadataOwnershipExtractor', () => {
    it('returns an empty list when no ownership markers are present', () => {
        expect(MetadataOwnershipExtractor.extract({ env: 'staging' }, { note: 'hello' }, 'default')).toEqual([])
    })

    it('extracts a Helm badge from release annotations, chart label, and differing namespace', () => {
        const badges = MetadataOwnershipExtractor.extract(
            { 'helm.sh/chart': 'ingress-nginx-4.10.0' },
            {
                'meta.helm.sh/release-name': 'ingress-nginx',
                'meta.helm.sh/release-namespace': 'ingress-system',
            },
            'default'
        )

        expect(badges).toEqual([
            {
                provider: 'helm',
                label: 'Helm',
                detail: 'ingress-nginx (ingress-system) · ingress-nginx-4.10.0',
                reference: {
                    kindName: 'HelmRelease',
                    apiVersion: '',
                    name: 'ingress-nginx',
                    namespace: 'ingress-system',
                    routeKind: 'helm',
                },
            },
        ])
    })

    it('extracts a Helm badge from managed-by label when release annotation is absent', () => {
        const badges = MetadataOwnershipExtractor.extract(
            {
                'app.kubernetes.io/managed-by': 'Helm',
                'app.kubernetes.io/instance': 'redis-cache',
            },
            {},
            'cache'
        )

        expect(badges).toEqual([
            {
                provider: 'helm',
                label: 'Helm',
                detail: 'redis-cache',
                reference: {
                    kindName: 'HelmRelease',
                    apiVersion: '',
                    name: 'redis-cache',
                    namespace: 'cache',
                    routeKind: 'helm',
                },
            },
        ])
    })

    it('extracts an ArgoCD badge from tracking-id first segment or instance label', () => {
        const fromTracking = MetadataOwnershipExtractor.extract(
            { 'argocd.argoproj.io/instance': 'fallback-app' },
            { 'argocd.argoproj.io/tracking-id': 'payments-prod:apps/Deployment:prod/payments' },
            'prod'
        )
        expect(fromTracking).toEqual([
            {
                provider: 'argocd',
                label: 'ArgoCD',
                detail: 'payments-prod',
                reference: {
                    kindName: 'Application',
                    apiVersion: 'argoproj.io/v1alpha1',
                    name: 'payments-prod',
                    namespace: '',
                    routeKind: 'argocd',
                },
            },
        ])

        const fromInstance = MetadataOwnershipExtractor.extract(
            { 'argocd.argoproj.io/instance': 'billing-app' },
            {},
            'prod'
        )
        expect(fromInstance[0]?.detail).toBe('billing-app')
        expect(fromInstance[0]?.reference?.routeKind).toBe('argocd')
    })

    it('extracts an App badge preferring part-of over name and combining version', () => {
        const badges = MetadataOwnershipExtractor.extract(
            {
                'app.kubernetes.io/part-of': 'payments',
                'app.kubernetes.io/name': 'payments-api',
                'app.kubernetes.io/version': 'v1.4.2',
            },
            {},
            'prod'
        )

        expect(badges).toEqual([
            {
                provider: 'k8s-app',
                label: 'App',
                detail: 'payments · v1.4.2',
            },
        ])
    })

    it('extracts a Prometheus badge with port and path or enabled fallback', () => {
        const withPortAndPath = MetadataOwnershipExtractor.extract(
            {},
            {
                'prometheus.io/scrape': 'true',
                'prometheus.io/port': '9090',
                'prometheus.io/path': '/metrics',
            },
            'monitoring'
        )
        expect(withPortAndPath).toEqual([
            {
                provider: 'prometheus',
                label: 'Prometheus',
                detail: ':9090/metrics',
            },
        ])

        const enabledOnly = MetadataOwnershipExtractor.extract(
            {},
            { 'prometheus.io/scrape': 'TRUE' },
            'monitoring'
        )
        expect(enabledOnly).toEqual([
            {
                provider: 'prometheus',
                label: 'Prometheus',
                detail: 'enabled',
            },
        ])

        const disabled = MetadataOwnershipExtractor.extract(
            {},
            { 'prometheus.io/scrape': 'false', 'prometheus.io/port': '9090' },
            'monitoring'
        )
        expect(disabled).toEqual([])
    })

    it('returns all four badges in deterministic order when all markers exist', () => {
        const badges = MetadataOwnershipExtractor.extract(
            {
                'app.kubernetes.io/name': 'checkout',
                'app.kubernetes.io/version': '2.1.0',
                'argocd.argoproj.io/instance': 'checkout-gitops',
            },
            {
                'meta.helm.sh/release-name': 'checkout-release',
                'prometheus.io/scrape': 'true',
                'prometheus.io/port': '8080',
            },
            'shop'
        )

        expect(badges.map((badge) => badge.provider)).toEqual([
            'helm',
            'argocd',
            'k8s-app',
            'prometheus',
        ])
    })
})
