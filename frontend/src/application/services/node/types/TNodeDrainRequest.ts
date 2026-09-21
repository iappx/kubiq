import type { KubeResourceKind } from '@/domain/models/kube'
import type { TNodeTarget } from '@/application/services/node/types/TNodeTarget'

export type TNodeDrainRequest = {
    target: TNodeTarget
    podsKind: KubeResourceKind
}
