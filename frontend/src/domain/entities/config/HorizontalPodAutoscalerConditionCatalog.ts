export class HorizontalPodAutoscalerConditionCatalog {
    public static readonly ableToScale: string = 'AbleToScale'

    public static readonly scalingActive: string = 'ScalingActive'

    public static readonly scalingLimited: string = 'ScalingLimited'

    public static all(): string[] {
        return [
            HorizontalPodAutoscalerConditionCatalog.ableToScale,
            HorizontalPodAutoscalerConditionCatalog.scalingActive,
            HorizontalPodAutoscalerConditionCatalog.scalingLimited,
        ]
    }

    public static has(type: string): boolean {
        return HorizontalPodAutoscalerConditionCatalog.all().includes(type)
    }
}
