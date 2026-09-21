export class WorkloadAnnotations {
    public static readonly restartedAt: string = 'kubectl.kubernetes.io/restartedAt'

    public static readonly instantiate: string = 'cronjob.kubernetes.io/instantiate'

    public static readonly manual: string = 'manual'
}
