declare module "/@react-refresh" {
  const RefreshRuntime: {
    injectIntoGlobalHook(target: Window): void
  }
  export default RefreshRuntime
}

interface Window {
  $RefreshReg$: () => void
  $RefreshSig$: () => (type: unknown) => unknown
  __vite_plugin_react_preamble_installed__: boolean
}
