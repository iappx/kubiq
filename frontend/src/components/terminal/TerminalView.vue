<template>
  <div
      ref="host"
      :aria-label="label"
      class="terminal-host h-full w-full min-h-0"
      role="group"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { TerminalTheme } from '@/components/terminal/TerminalTheme'
import { TerminalBytes } from '@/domain/models/terminal'
import { AppThemeStore } from '@/store/modules/appTheme/AppThemeStore'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { TerminalStore } from '@/store/modules/terminal/TerminalStore'

@Component({})
export default class TerminalView extends VueBase {
  public static readonly compactFontSize = 12

  public static readonly comfortableFontSize = 13

  @Prop({ required: true })
  public readonly sessionKey: string

  @Prop({ required: false, default: 'Terminal' })
  public readonly label?: string

  @Prop({ required: false, default: '' })
  public readonly search?: string

  private terminal: Terminal | null = null

  private fitAddon: FitAddon | null = null

  private searchAddon: SearchAddon | null = null

  private observer: ResizeObserver | null = null

  constructor(
      @inject(TerminalStore) private readonly terminalStore: TerminalStore,
      @inject(AppThemeStore) private readonly themeStore: AppThemeStore,
      @inject(AppUiStore) private readonly uiStore: AppUiStore,
  ) {
    super()
  }

  mounted(): void {
    this.build()
  }

  beforeUnmount(): void {
    this.terminalStore.detachView(this.sessionKey)
    this.observer?.disconnect()
    this.observer = null
    this.terminal?.dispose()
    this.terminal = null
    this.fitAddon = null
    this.searchAddon = null
  }

  @Watch('themeStore.appTheme')
  themeChanged(): void {
    const root = document.documentElement
    if (this.terminal) {
      this.terminal.options.theme = TerminalTheme.build(root)
    }
  }

  @Watch('uiStore.density')
  densityChanged(): void {
    if (this.terminal) {
      this.terminal.options.fontSize = this.fontSize
      this.resize()
    }
  }

  @Watch('search')
  searchChanged(value: string): void {
    if (value === '') {
      this.searchAddon?.clearDecorations()
      return
    }

    this.searchAddon?.findNext(value, { incremental: true })
  }

  public findNext(): void {
    if (this.search) {
      this.searchAddon?.findNext(this.search)
    }
  }

  public findPrevious(): void {
    if (this.search) {
      this.searchAddon?.findPrevious(this.search)
    }
  }

  public focus(): void {
    this.terminal?.focus()
  }

  public selection(): string {
    return this.terminal?.getSelection() ?? ''
  }

  private get fontSize(): number {
    return this.uiStore.density === 'comfortable'
      ? TerminalView.comfortableFontSize
      : TerminalView.compactFontSize
  }

  private build(): void {
    const host = this.$refs.host as HTMLElement | undefined
    if (!host) {
      return
    }

    const terminal = new Terminal({
      allowProposedApi: true,
      convertEol: false,
      cursorBlink: true,
      fontFamily: TerminalTheme.fontFamily(document.documentElement),
      fontSize: this.fontSize,
      scrollback: 5000,
      theme: TerminalTheme.build(document.documentElement),
    })

    this.fitAddon = new FitAddon()
    this.searchAddon = new SearchAddon()

    terminal.loadAddon(this.fitAddon)
    terminal.loadAddon(this.searchAddon)
    terminal.loadAddon(new WebLinksAddon((_event, uri) => this.terminalStore.openLink(uri)))

    terminal.open(host)
    terminal.onData(text => this.terminalStore.write(this.sessionKey, TerminalBytes.fromText(text)))
    terminal.onBinary(text => this.terminalStore.write(this.sessionKey, TerminalBytes.fromText(text)))

    this.terminal = terminal
    this.terminalStore.attachView(this.sessionKey, data => terminal.write(data))

    this.observe(host)
    this.resize()
    terminal.focus()
  }

  private observe(host: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
  }

  // A hidden dock reports a zero box, and fitting to it would tell the cluster the
  // terminal is 0x0 and wrap every following line at column one.
  private resize(): void {
    const terminal = this.terminal
    if (!terminal || !this.fitAddon) {
      return
    }

    const size = this.fitAddon.proposeDimensions()
    if (!size || size.cols < 1 || size.rows < 1) {
      return
    }

    this.fitAddon.fit()
    this.terminalStore.resize(this.sessionKey, terminal.cols, terminal.rows)
  }
}
</script>

<style scoped>
.terminal-host :deep(.xterm) {
  height: 100%;
  padding: 4px 8px;
}

.terminal-host :deep(.xterm-viewport) {
  background-color: transparent !important;
}
</style>
