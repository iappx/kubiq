import { container, singleton } from 'tsyringe'
import { defineStore } from 'pinia'
import { Constructor } from '../types/Constructor'
import { transformClass } from '../utils/class-transformer/transformClass'
import { TypeIdentity } from '@/lib/extendedTypes/TypeIdentity'

export const InjectableStore = (target: Constructor<any>) => {
    singleton()(target)
    const name = TypeIdentity.guid(target)
    container.register(name + '_token', target)
    const storeFunc = defineStore(name, transformClass(target))
    container.register(target, { useFactory: () => storeFunc() })
}
