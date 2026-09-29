import type { KubeResourceKind } from '@/domain/models/kube'

export class OpenClusterObjectEvent {
    constructor(
        public readonly clusterId: string,
        public readonly kind: KubeResourceKind,
        public readonly namespace: string,
        public readonly name: string,
    ) {
    }
}
