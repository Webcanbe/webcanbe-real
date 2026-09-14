/** Additional metadata is preserved as source bytes, never loaded as editor configuration.
 * The grammar is deliberately finite. It does not grant package-manager execution. */
export function isExampleEnvironment(name: string) { return /^\.env\.example(?:-[a-z][a-z0-9-]{0,31})?$/.test(name) }
export function isInertMetadata(name: string) { return [".gitattributes", ".editorconfig", ".npmrc", ".prettierignore", ".prettierrc"].includes(name) || isExampleEnvironment(name) }
export const METADATA_BYTES = 16 * 1024
export function validateIntakeMetadata(name: string, bytes: Buffer) {
  if (!isInertMetadata(name)) return
  if (bytes.length > METADATA_BYTES) throw new Error("Project metadata exceeds the 16 KiB limit.")
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || /-----BEGIN .*PRIVATE KEY-----|(?:gh[pousr]_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]+|(?:password|token|secret|credential|api[_-]?key|access[_-]?key)\s*[:=]\s*[^\s]+/i.test(text)) throw new Error("Secret or control data in project metadata.")
  if (name === ".gitattributes") {
    // Only inert text/eol declarations, never filters, diff drivers, includes,
    // macros, export-ignore or export-subst. Export retains every original byte.
    for(const line of text.split(/\r?\n/)) {
      if(!line.trim()||/^\s*#/.test(line))continue
      if(!/^[a-zA-Z0-9_.*?/[\]{}-]{1,256}(?:[ \t]+(?:text(?:=auto)?|-text|eol=(?:lf|crlf)))+[ \t]*$/.test(line))throw new Error("Unsupported Git attributes metadata.")
    }
  } else if (name === ".npmrc") {
    // These values affect package-manager operation only. They are not used by
    // compilation, and never authorize registry/auth/shell/script configuration.
    const seen = new Set<string>()
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || /^\s*[#;]/.test(line)) continue
      const match = /^(strict-peer-dependencies|shell-emulator)=(true|false)\s*$/.exec(line)
      if (!match || seen.has(match[1])) throw new Error("Unsupported or secret npm configuration.")
      seen.add(match[1])
    }
  } else if (isExampleEnvironment(name)) {
    const seen = new Set<string>()
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || /^\s*#/.test(line)) continue
      const match = /^(VITE_[A-Z][A-Z0-9_]{0,79})=(.*)$/.exec(line)
      if (!match || seen.has(match[1]) || /TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL|API_KEY|ACCESS_KEY/.test(match[1])) throw new Error("Unsupported or secret example environment data.")
      seen.add(match[1])
      const value = match[2].trim()
      if (/^(?:|true|false|[0-9]{1,5}|YOUR_[A-Z_]+|<PLACEHOLDER>)$/.test(value)) continue
      let url: URL
      try { url = new URL(value) } catch { throw new Error("Example environment value is not admitted public metadata.") }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^(?:localhost|127\.0\.0\.1|\[::1\]|(?:[a-z0-9-]+\.)*(?:example\.com|example\.org|example\.net|invalid|test))$/i.test(url.hostname) || !/^\/(?:[a-zA-Z0-9/_-]*)$/.test(url.pathname) || value.length > 256) throw new Error("Credential-bearing or unsupported example URL.")
    }
  } else if (name === ".editorconfig") {
    for (const line of text.split(/\r?\n/)) if (line.trim() && !/^\s*[#;]/.test(line) && !/^\[[^\]\r\n]{1,128}\]$/.test(line) && !/^(?:root|indent_style|indent_size|tab_width|end_of_line|charset|trim_trailing_whitespace|insert_final_newline|max_line_length)\s*=\s*(?:true|false|space|tab|lf|crlf|cr|utf-8|utf-8-bom|latin1|utf-16be|utf-16le|off|unset|[0-9]{1,4})\s*$/.test(line)) throw new Error("Unsupported EditorConfig metadata.")
  } else if (name === ".prettierrc") {
    const value = JSON.parse(text)
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Unsupported formatter metadata.")
    for (const [key, item] of Object.entries(value)) {
      const valid = ["semi", "singleQuote", "useTabs", "bracketSpacing"].includes(key) ? typeof item === "boolean"
        : ["tabWidth", "printWidth"].includes(key) ? typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= (key === "tabWidth" ? 16 : 1000)
        : key === "trailingComma" ? typeof item === "string" && ["all", "es5", "none"].includes(item)
        : key === "arrowParens" ? typeof item === "string" && ["always", "avoid"].includes(item)
        : key === "endOfLine" ? typeof item === "string" && ["lf", "crlf", "cr", "auto"].includes(item) : false
      if (!valid) throw new Error("Unsupported formatter metadata.")
    }
  } else if (name === ".prettierignore") {
    if (text.split(/\r?\n/).some(line => line.trim() && !/^\s*#/.test(line) && !/^[!a-zA-Z0-9_.*?/[\]{}-]{1,256}$/.test(line))) throw new Error("Unsupported formatter ignore metadata.")
  }
}
