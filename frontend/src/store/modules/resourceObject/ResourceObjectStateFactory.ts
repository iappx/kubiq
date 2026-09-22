import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

export class ResourceObjectStateFactory {
    public static empty(): TResourceObjectState {
        return {
            loading: false,
            loaded: false,
            error: '',
            errorDetail: '',
            forbidden: false,
            missing: false,
            object: {},
            relations: [],
            relationsLoading: false,
            environment: [],
            environmentLoaded: false,
            environmentLoading: false,
            environmentError: '',
            events: [],
            eventsLoaded: false,
            eventsLoading: false,
            eventsError: '',
            eventsWatching: false,
            eventsStaleSince: 0,
            applying: false,
            conflict: {},
        }
    }
}
