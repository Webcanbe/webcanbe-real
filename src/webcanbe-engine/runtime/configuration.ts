import postcss from "postcss"
/** CSS-first Tailwind theme declarations are data, not Node configuration.
 * Keep the original profile unchanged; versioned expanded profiles translate
 * only literal root @theme declarations through the pinned Tailwind compiler. */
export function validateStylesheetConfiguration(source: string, expandedProfile: boolean) {
  const root = postcss.parse(source)
  let theme = false
  root.walkAtRules(rule => {
    if (/^(plugin|config|source|tailwind|utility|variant|custom-variant|apply|reference|screen)$/i.test(rule.name)) throw new Error("Tailwind executable/scanning directives require isolated configuration support.")
    if (rule.name !== "theme") return
    if (!expandedProfile || rule.parent?.type !== "root" || rule.params.trim() || !rule.nodes?.length) throw new Error("Tailwind @theme requires a versioned static theme profile.")
    for (const node of rule.nodes) {
      if (node.type === "comment") continue
      if (node.type !== "decl" || !/^--[a-z][a-z0-9-]*$/.test(node.prop) || node.important || !/^(?:#[a-fA-F0-9]{3,8}|-?\d+(?:\.\d+)?(?:px|rem|em|%|ms|s)?|[a-zA-Z][a-zA-Z0-9 -]*|"[a-zA-Z0-9 -]+"|'[a-zA-Z0-9 -]+')$/.test(node.value)) throw new Error("Tailwind theme requires literal custom properties; dynamic/functions/nested theme forms are unsupported.")
    }
    theme = true
  })
  if (theme && !/@import\s+["']tailwindcss["']\s*;/.test(source)) throw new Error("Static theme requires the declared Tailwind stylesheet in the same file.")
  return { theme }
}
