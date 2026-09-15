/** Additional metadata is preserved as source bytes, never loaded as editor configuration.
 * The grammar is deliberately finite. It does not grant package-manager execution. */
export function isExampleEnvironment(name: string) { return /^\.env\.example(?:-[a-z][a-z0-9-]{0,31})?$/.test(name) }
export function isInertMetadata(name: string) { return [".gitattributes", ".editorconfig", ".npmrc", ".prettierignore", ".prettierrc", ".node-version", ".nvmrc", ".whitesource", "_redirects"].includes(name) || isExampleEnvironment(name) }
export const METADATA_BYTES = 16 * 1024
export const INERT_TOOL_BYTES = 4 * 1024 * 1024
/** Exact operator-independent role for bundled package-manager tooling. These bytes are
 * preserved for source ownership/export only and never become executable editor input. */
export function isInertToolingPath(name: string) {
  return /^\.yarn\/releases\/yarn-\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][0-9A-Za-z.-]{1,64})?\.cjs$/.test(name)
}
export function archiveMemberLimit(name: string) { return isInertToolingPath(name) ? INERT_TOOL_BYTES : 2 * 1024 * 1024 }
export function validateIntakeMetadata(name: string, bytes: Buffer) {
  if (!isInertMetadata(name)) return
  if (bytes.length > METADATA_BYTES) throw new Error("Project metadata exceeds the 16 KiB limit.")
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || /-----BEGIN .*PRIVATE KEY-----|(?:gh[pousr]_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]+|(?:password|token|secret|credential|api[_-]?key|access[_-]?key)\s*[:=]\s*[^\s]+/i.test(text)) throw new Error("Secret or control data in project metadata.")
  if ([".node-version",".nvmrc"].includes(name)) {
    if(!/^v?\d{1,3}(?:\.\d{1,3}){0,2}\s*$/.test(text))throw Error("Only a literal Node version hint is preserved.")
  } else if(name==="_redirects") {
    if(text.split(/\r?\n/).filter(l=>l.trim()&&!/^\s*#/.test(l)).some(l=>!/^\/\* +\/index\.html +200\s*$/.test(l)))throw Error("Only inert SPA fallback metadata is supported.")
  } else if(name===".whitesource") {
    const config=JSON.parse(text),allowed:Record<string,Record<string,(v:unknown)=>boolean>>={
      scanSettings:{baseBranches:v=>Array.isArray(v)&&v.length<=16&&v.every(x=>typeof x==="string"&&/^[a-zA-Z0-9_/-]{1,80}$/.test(x))},
      checkRunSettings:{vulnerableCheckRunConclusionLevel:v=>["failure","success","neutral"].includes(String(v)),displayMode:v=>["diff","baseline"].includes(String(v)),useMendCheckNames:v=>typeof v==="boolean"},
      issueSettings:{minSeverityLevel:v=>["LOW","MEDIUM","HIGH","CRITICAL"].includes(String(v)),issueType:v=>["DEPENDENCY","SECURITY"].includes(String(v))}}
    if(!config||typeof config!=="object"||Array.isArray(config))throw Error("Invalid scanner metadata.")
    for(const [section,fields]of Object.entries(config)) {
      if(!Object.prototype.hasOwnProperty.call(allowed,section)||!fields||typeof fields!=="object"||Array.isArray(fields))throw Error("Unsupported scanner metadata.")
      for(const [key,value]of Object.entries(fields))if(!Object.prototype.hasOwnProperty.call(allowed[section],key)||!allowed[section][key](value))throw Error("Unsupported scanner setting.")
    }
  } else if (name === ".gitattributes") {
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
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || /password|token|secret|credential|private|api[-_]?key|access[-_]?key/i.test(url.pathname) || !/^(?:localhost|127\.0\.0\.1|\[::1\]|[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)$/i.test(url.hostname) || !/^\/(?:[a-zA-Z0-9/_-]*)$/.test(url.pathname) || value.length > 256) throw new Error("Credential-bearing or unsupported example URL.")
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

/** Opaque Bun v0/version2 metadata is stored/exported only, never decoded as a
 * dependency graph or executed. Runtime inspection still refuses binary locks. */
export function isOpaqueBunLock(name:string,bytes:Buffer) {
  const magic=Buffer.from("#!/usr/bin/env bun\nbun-lockfile-format-v0\n")
  return name==="bun.lockb" && bytes.length>=magic.length+40 && bytes.length<=2*1024*1024 && bytes.subarray(0,magic.length).equals(magic) && bytes.readUInt32LE(magic.length)===2
}
