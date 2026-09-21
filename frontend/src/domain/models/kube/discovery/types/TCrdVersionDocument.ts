import type { TCrdPrinterColumnDocument } from '@/domain/models/kube/discovery/types/TCrdPrinterColumnDocument'

export type TCrdVersionDocument = {
    name?: string
    served?: boolean
    storage?: boolean
    additionalPrinterColumns?: TCrdPrinterColumnDocument[]
}
