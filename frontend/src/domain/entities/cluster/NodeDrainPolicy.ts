import type { PodEntity } from '@/domain/entities/workloads/PodEntity'
import type { TNodeDrainVerdict } from '@/domain/entities/cluster/types/TNodeDrainVerdict'

// The three exemptions are kubectl drain's, not ours: departing from them silently
// leaves pods the operator expected to move.
export class NodeDrainPolicy {
    public static readonly mirrorAnnotation: string = 'kubernetes.io/config.mirror'

    public static readonly daemonSetKind: string = 'DaemonSet'

    public static verdictFor(pod: PodEntity): TNodeDrainVerdict {
        if (NodeDrainPolicy.isMirror(pod)) {
            return { evict: false, reason: 'Mirror pod, managed by the kubelet' }
        }
        if (NodeDrainPolicy.isDaemonSetPod(pod)) {
            return { evict: false, reason: 'Owned by a DaemonSet' }
        }
        if (NodeDrainPolicy.isFinished(pod)) {
            return { evict: false, reason: `Already ${pod.phase}` }
        }

        return { evict: true, reason: '' }
    }

    public static evictable(pods: readonly PodEntity[]): PodEntity[] {
        return pods.filter(pod => NodeDrainPolicy.verdictFor(pod).evict)
    }

    public static skipped(pods: readonly PodEntity[]): PodEntity[] {
        return pods.filter(pod => !NodeDrainPolicy.verdictFor(pod).evict)
    }

    public static isMirror(pod: PodEntity): boolean {
        return pod.metadata?.annotation(NodeDrainPolicy.mirrorAnnotation) !== undefined
    }

    public static isDaemonSetPod(pod: PodEntity): boolean {
        return (pod.metadata?.ownerReferences ?? [])
            .some(owner => owner.kind === NodeDrainPolicy.daemonSetKind)
    }

    public static isFinished(pod: PodEntity): boolean {
        return pod.phase === 'Succeeded' || pod.phase === 'Failed'
    }
}
