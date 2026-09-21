import { injectable } from 'tsyringe'
import { Uuid } from '@/lib/uuid/Uuid'

@injectable()
export class IdService {
    public next(): string {
        return Uuid.v4()
    }
}
