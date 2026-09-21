import 'reflect-metadata'
void (Reflect as any).getMetadata
import { AppBootstrap } from '@/AppBootstrap'

import '@/assets/styles/css/index.css'

AppBootstrap.createApp().catch(err => {
    console.error('Can not run app', err)
})
