import type { TYamlDiffLine } from '@/application/services/resourceYaml/types/TYamlDiffLine'
import type { TYamlDiffSummary } from '@/application/services/resourceYaml/types/TYamlDiffSummary'

export type TLastAppliedDiffResult = {
    lines: TYamlDiffLine[]
    condensedLines: TYamlDiffLine[]
    summary: TYamlDiffSummary
    hasChanges: boolean
    appliedYaml: string
    currentYaml: string
}
