import type { TYamlDiffKind } from '@/application/services/resourceYaml/types/TYamlDiffKind'

export type TYamlDiffLine = {
    kind: TYamlDiffKind
    text: string
    leftNumber: number
    rightNumber: number
}
