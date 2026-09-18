// @ts-expect-error Vite supplies this development-only virtual module.
import RefreshRuntime from "/@react-refresh"

RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type: unknown) => type
window.__vite_plugin_react_preamble_installed__ = true
