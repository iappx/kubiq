import type { TObjectEventsRequest } from '@/application/services/resourceEvents/types/TObjectEventsRequest'

export class ResourceEventSelector {
    // involvedObject.uid is an indexed field on core Events, so the API server is
    // what narrows the list; kind+name is the next indexed thing when there is no uid.
    public static forObject(request: TObjectEventsRequest): string {
        if (request.uid !== '') {
            return `involvedObject.uid=${request.uid}`
        }

        return `involvedObject.kind=${request.kind.kind},involvedObject.name=${request.name}`
    }
}
