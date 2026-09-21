import type { TNamespacePhase } from '@/domain/entities/cluster/types/TNamespacePhase'

export class NamespacePhaseCatalog {
    public static readonly values: Record<TNamespacePhase, string> = {
        Active: 'Active',
        Terminating: 'Terminating',
    }

    public static title(phase: TNamespacePhase): string {
        return NamespacePhaseCatalog.values[phase] ?? phase
    }

    public static has(phase: string): boolean {
        return Object.prototype.hasOwnProperty.call(NamespacePhaseCatalog.values, phase)
    }
}
