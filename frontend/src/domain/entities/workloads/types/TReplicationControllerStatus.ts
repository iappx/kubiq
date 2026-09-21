export type TReplicationControllerStatus = {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    fullyLabeledReplicas?: number
    observedGeneration?: number
}
