import type { THelmInstallDraft } from '@/domain/entities/helm/types/THelmInstallDraft'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import type { THelmUpgradeDraft } from '@/domain/entities/helm/types/THelmUpgradeDraft'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import type { THelmStreamRequest } from '@/infrastructure/entityRepo/helm/transport/types/THelmStreamRequest'

export class HelmOperationPlan {
    public static install(draft: THelmInstallDraft): THelmStreamRequest {
        return {
            args: [
                ...HelmCommand.install(draft.releaseName, draft.chart, draft.version, draft.createNamespace),
                ...HelmCommand.namespace(draft.namespace),
            ],
            values: draft.values,
        }
    }

    // The editor holds the release's complete user-supplied values, so the default is to
    // reset and reapply: --reuse-values would merge and silently keep what was deleted.
    public static upgrade(draft: THelmUpgradeDraft): THelmStreamRequest {
        return {
            args: [
                ...HelmCommand.upgrade(draft.releaseName, draft.chart, draft.version, draft.reuseValues),
                ...HelmCommand.namespace(draft.namespace),
            ],
            values: draft.values,
        }
    }

    public static uninstall(ref: THelmReleaseRef, keepHistory: boolean): THelmStreamRequest {
        return {
            args: [
                ...HelmCommand.uninstall(ref.name, keepHistory),
                ...HelmCommand.namespace(ref.namespace),
            ],
        }
    }

    public static rollback(ref: THelmReleaseRef, revision: number): THelmStreamRequest {
        return {
            args: [
                ...HelmCommand.rollback(ref.name, revision),
                ...HelmCommand.namespace(ref.namespace),
            ],
        }
    }
}
