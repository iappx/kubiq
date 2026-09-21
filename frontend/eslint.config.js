import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
    {
        ignores: ['dist/**', 'bindings/**', 'components.d.ts'],
    },
    js.configs.recommended,
    pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
            'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
            'no-empty': 1,
            'no-unused-vars': 0,
            'no-case-declarations': 0,
            '@typescript-eslint/no-explicit-any': 0,
            // Base classes spell out the full signature in their default
            // implementation and leave the arguments to the overrides — the names
            // are the documentation, so an unused argument is not a defect here.
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
            '@typescript-eslint/no-empty-function': 1,
            '@typescript-eslint/no-inferrable-types': 0,
            // The DI/decorator/reflection infrastructure in src/lib, src/domain and the
            // event bus legitimately needs `Function` as a registry key, `{}` as a generic
            // default, `this` aliasing in the type walker and raw hasOwnProperty on plain
            // objects. These are metaprogramming idioms, not accidents — do not "fix" them.
            // (typescript-eslint 8 split the former `ban-types` into these three.)
            '@typescript-eslint/no-empty-object-type': 0,
            '@typescript-eslint/no-unsafe-function-type': 0,
            '@typescript-eslint/no-wrapper-object-types': 0,
            '@typescript-eslint/no-this-alias': 0,
            'no-prototype-builtins': 0,
            'vue/no-v-model-argument': 0,
            'vue/no-v-for-template-key': 0,
            'no-extra-boolean-cast': 0,
            'vue/valid-v-slot': ['error', {
                allowModifiers: true,
            }],
        },
    },
)
