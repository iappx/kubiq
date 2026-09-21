export class ResourceRelationLimits {
    // Pod → ReplicaSet → Deployment is three, and an ownerReference cycle is a
    // broken cluster rather than a shape to follow forever.
    public static readonly maxOwnerHops: number = 4

    public static readonly maxRelatedServices: number = 500
}
