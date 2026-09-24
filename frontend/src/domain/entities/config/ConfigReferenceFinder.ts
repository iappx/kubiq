import { PodSpecReader } from '@/domain/entities/workloads/PodSpecReader'
import { KubeManifest } from '@/domain/models/kube/KubeManifest'
import type { TConfigObjectKind } from '@/domain/entities/config/types/TConfigObjectKind'
import type { TConfigReferenceTarget } from '@/domain/entities/config/types/TConfigReferenceTarget'
import type { TConfigReferenceUse } from '@/domain/entities/config/types/TConfigReferenceUse'
import type { TConfigReferrerKind } from '@/domain/entities/config/types/TConfigReferrerKind'

export class ConfigReferenceFinder {
    public static readonly serviceAccountKind: string = 'ServiceAccount'

    public static readonly ingressKind: string = 'Ingress'

    public static readonly podReferrers: readonly TConfigReferrerKind[] = [
        { apiVersion: 'apps/v1', kind: 'Deployment' },
        { apiVersion: 'apps/v1', kind: 'StatefulSet' },
        { apiVersion: 'apps/v1', kind: 'DaemonSet' },
        { apiVersion: 'apps/v1', kind: 'ReplicaSet' },
        { apiVersion: 'batch/v1', kind: 'Job' },
        { apiVersion: 'batch/v1', kind: 'CronJob' },
        { apiVersion: 'v1', kind: 'Pod' },
    ]

    public static readonly secretReferrers: readonly TConfigReferrerKind[] = [
        { apiVersion: 'v1', kind: ConfigReferenceFinder.serviceAccountKind },
        { apiVersion: 'networking.k8s.io/v1', kind: ConfigReferenceFinder.ingressKind },
    ]

    private static readonly containerFields: readonly string[] = ['initContainers', 'containers', 'ephemeralContainers']

    public static referrersOf(objectKind: TConfigObjectKind): TConfigReferrerKind[] {
        return objectKind === 'secret'
            ? [...ConfigReferenceFinder.podReferrers, ...ConfigReferenceFinder.secretReferrers]
            : [...ConfigReferenceFinder.podReferrers]
    }

    public static usesIn(
        referrerKind: string,
        object: Record<string, unknown>,
        target: TConfigReferenceTarget,
    ): TConfigReferenceUse[] {
        if (target.name === '') {
            return []
        }
        if (referrerKind === ConfigReferenceFinder.serviceAccountKind) {
            return ConfigReferenceFinder.inServiceAccount(object, target)
        }
        if (referrerKind === ConfigReferenceFinder.ingressKind) {
            return ConfigReferenceFinder.inIngress(object, target)
        }

        return ConfigReferenceFinder.inPodSpec(object, target)
    }

    private static inPodSpec(object: Record<string, unknown>, target: TConfigReferenceTarget): TConfigReferenceUse[] {
        const spec = PodSpecReader.of(object) as Record<string, unknown>
        const volumes = ConfigReferenceFinder.records(spec.volumes)
        const containers = ConfigReferenceFinder.containerFields
            .flatMap(field => ConfigReferenceFinder.records(spec[field]))
        const isSecret = target.objectKind === 'secret'

        const found: [TConfigReferenceUse, boolean][] = [
            ['volume', volumes.some(volume => ConfigReferenceFinder.volumeNameOf(volume, target.objectKind) === target.name)],
            ['projectedVolume', volumes.some(volume => ConfigReferenceFinder.projectedNamesOf(volume, target.objectKind).includes(target.name))],
            ['envFrom', containers.some(container => ConfigReferenceFinder.envFromNamesOf(container, target.objectKind).includes(target.name))],
            ['env', containers.some(container => ConfigReferenceFinder.envNamesOf(container, target.objectKind).includes(target.name))],
            ['imagePullSecret', isSecret && ConfigReferenceFinder.namesOf(spec.imagePullSecrets).includes(target.name)],
        ]

        return ConfigReferenceFinder.present(found)
    }

    private static inServiceAccount(object: Record<string, unknown>, target: TConfigReferenceTarget): TConfigReferenceUse[] {
        if (target.objectKind !== 'secret') {
            return []
        }

        return ConfigReferenceFinder.present([
            ['mountableSecret', ConfigReferenceFinder.namesOf(object.secrets).includes(target.name)],
            ['imagePullSecret', ConfigReferenceFinder.namesOf(object.imagePullSecrets).includes(target.name)],
        ])
    }

    private static inIngress(object: Record<string, unknown>, target: TConfigReferenceTarget): TConfigReferenceUse[] {
        if (target.objectKind !== 'secret') {
            return []
        }

        const spec = KubeManifest.isObject(object.spec) ? object.spec : {}
        const secretNames = ConfigReferenceFinder.records(spec.tls)
            .map(tls => ConfigReferenceFinder.text(tls.secretName))

        return secretNames.includes(target.name) ? ['tls'] : []
    }

    private static volumeNameOf(volume: Record<string, unknown>, objectKind: TConfigObjectKind): string {
        return objectKind === 'secret'
            ? ConfigReferenceFinder.fieldOf(volume.secret, 'secretName')
            : ConfigReferenceFinder.fieldOf(volume.configMap, 'name')
    }

    private static projectedNamesOf(volume: Record<string, unknown>, objectKind: TConfigObjectKind): string[] {
        const projected = KubeManifest.isObject(volume.projected) ? volume.projected : {}

        return ConfigReferenceFinder.records(projected.sources)
            .map(source => ConfigReferenceFinder.fieldOf(objectKind === 'secret' ? source.secret : source.configMap, 'name'))
    }

    private static envFromNamesOf(container: Record<string, unknown>, objectKind: TConfigObjectKind): string[] {
        return ConfigReferenceFinder.records(container.envFrom)
            .map(source => ConfigReferenceFinder.fieldOf(
                objectKind === 'secret' ? source.secretRef : source.configMapRef,
                'name',
            ))
    }

    private static envNamesOf(container: Record<string, unknown>, objectKind: TConfigObjectKind): string[] {
        return ConfigReferenceFinder.records(container.env)
            .map(variable => (KubeManifest.isObject(variable.valueFrom) ? variable.valueFrom : {}))
            .map(from => ConfigReferenceFinder.fieldOf(
                objectKind === 'secret' ? from.secretKeyRef : from.configMapKeyRef,
                'name',
            ))
    }

    private static namesOf(references: unknown): string[] {
        return ConfigReferenceFinder.records(references).map(reference => ConfigReferenceFinder.text(reference.name))
    }

    private static present(found: readonly [TConfigReferenceUse, boolean][]): TConfigReferenceUse[] {
        return found.filter(([, matched]) => matched).map(([use]) => use)
    }

    private static records(value: unknown): Record<string, unknown>[] {
        return Array.isArray(value)
            ? value.filter((item): item is Record<string, unknown> => KubeManifest.isObject(item))
            : []
    }

    private static fieldOf(value: unknown, field: string): string {
        return KubeManifest.isObject(value) ? ConfigReferenceFinder.text(value[field]) : ''
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}
