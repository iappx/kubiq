import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'

// Scaffolding: the message catalogue starts empty on purpose. Add keys to
// src/locales/*.json and a locale file per language as the app needs them.
const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en },
})

export default i18n
