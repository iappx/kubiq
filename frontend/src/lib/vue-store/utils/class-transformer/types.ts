import { _StringKeyObject, ReactiveStateTree, StoreFragment, TransformResult } from 'pinia-class-transformer'

export interface ProxyContainer<S extends object, F extends StoreFragment<S, F>> extends _StringKeyObject {
    state?: ReactiveStateTree<S>;
    wrappedStore?: TransformResult<S, F>;
}