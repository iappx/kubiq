import {
    _createProxy,
    _Result,
    Actions,
    ExcludeFunc,
    Func,
    ReactiveGettersTree,
    ReactiveStateTree,
    Store,
    StoreFragment,
    StoreSetup,
    TransformResult,
} from 'pinia-class-transformer'
import { computed, ref } from 'vue'
import { _ActionsTree, _GettersTree, StateTree } from 'pinia'
import { container } from 'tsyringe'
import { Constructor } from '../../types/Constructor'
import { ProxyContainer } from './types'
import { TypeIdentity } from '@/lib/extendedTypes/TypeIdentity'


function _getStoreFragment<S extends object, F extends StoreFragment<S, F>>(Fragment: Constructor<F>, result?: Record<string, any>): _Result<F> {
    const actions: _ActionsTree = {}
    const getters: _GettersTree<StateTree> = {}
    let setup: Func | undefined

    Object.getOwnPropertyNames(Fragment.prototype).forEach((propertyName) => {
        const descriptor = Object.getOwnPropertyDescriptor(Fragment.prototype, propertyName)
        const getter = descriptor?.get
        const setter = descriptor?.set
        const func = descriptor?.value

        if (getter && !setter) {
            getters[propertyName] = getter
        }

        if (typeof func === 'function' && func !== Fragment) {
            if (func.name === 'setup') {
                setup = func
            } else {
                actions[propertyName] = func
            }
        }
    })

    if (!result) {
        result = {
            actions: null,
            getters: null,
        }
    }
    // The chain is walked from the subclass upwards, so what is already in `result` is
    // the more derived definition: spreading the parent last would replace an override.
    if (!result.actions) {
        result.actions = actions
    } else {
        result.actions = { ...actions, ...result.actions }
    }

    if (!result.getters) {
        result.getters = getters
    } else {
        result.getters = { ...getters, ...result.getters }
    }

    if (!result.setup) {
        result.setup = setup
    }

    const recordFragment = Fragment as Record<string, any>
    if (recordFragment.__proto__ && recordFragment.__proto__ != Store) {
        result = _getStoreFragment(recordFragment.__proto__, result)
    }

    return result as _Result<F>
}

function _getState<S extends object>(State: Constructor<S>, result?: StateTree): ExcludeFunc<S> {
    const name = TypeIdentity.guid(State)
    const ins = container.resolve(name + '_token')

    Object.getOwnPropertyNames(ins).forEach((state) => {
        const descriptor = Object.getOwnPropertyDescriptor(ins, state)
        if (!result) {
            result = {}
        }
        if (descriptor && !result[state]) {
            result[state] = descriptor.value
        }
    })

    const recordState = State as Record<string, any>

    if (recordState.__proto__ && recordState.__proto__ != Store) {
        result = _getStoreFragment(recordState.__proto__, result)
    }

    return result as ExcludeFunc<S>
}

function transformClass<S extends object>(storeClass: Constructor<S>): StoreSetup<S>;
function transformClass<S extends object, F extends StoreFragment<S, F>>(
    state: Constructor<S>,
    storeFragment: Constructor<F>,
): StoreSetup<S, F>;
function transformClass<S extends object, F extends StoreFragment<S, F>>(
    stateOrWhole: Constructor<S>,
    storeFragment?: Constructor<F>,
): StoreSetup<S, F> {
    const proxyContainer: ProxyContainer<S, F> = {}
    const rootProxy = _createProxy(proxyContainer)

    const stateTree: ReactiveStateTree<S> = {} as ReactiveStateTree<S>

    Object.entries(_getState(stateOrWhole)).forEach(([key, value]) => {
        const refVal = ref(value)

        if (!storeFragment) {
            Reflect.set(rootProxy, key, refVal)
        }

        Reflect.set(stateTree, key, refVal)
    })

    if (storeFragment) {
        rootProxy.state = _createProxy(stateTree)
    }

    const fragment = storeFragment
        ? _getStoreFragment(storeFragment)
        : _getStoreFragment(stateOrWhole as unknown as Constructor<F>)

    const { setup } = fragment

    const getters: ReactiveGettersTree<F> = {} as ReactiveGettersTree<F>

    Object.entries(fragment.getters).forEach(([key, value]) => {
        const computedRef = computed((value as Func).bind(rootProxy))

        Reflect.set(rootProxy, key, computedRef)
        Reflect.set(getters, key, computedRef)
    })

    const actions: Actions<F> = {} as Actions<F>

    Object.entries(fragment.actions).forEach(([key, value]) => {
        const boundFunc = (value as Func).bind(rootProxy)

        Reflect.set(rootProxy, key, boundFunc)
        Reflect.set(actions, key, boundFunc)
    })

    const result: TransformResult<S, F> = { ...stateTree, ...getters, ...actions }

    rootProxy.wrappedStore = result

    return () => {
        if (setup) {
            Reflect.apply(setup, rootProxy, [])
        }

        return result
    }
}

export { transformClass }
