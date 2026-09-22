export const docPages: Record<string, { title: string; eyebrow: string; intro: string; video?: { src: string; title: string }; sections: { title: string; body: string }[] }> = {
  "/docs": { title: "Introduction", eyebrow: "Getting Started", intro: "Webcanbe is a source-first marketplace and browser workspace for real web projects.", sections: [
    { title: "The source is the product", body: "Visual, Code, Split, history, export, and future AI edits stay attached to the same working project source and revision." },
    { title: "Start from something real", body: "Marketplace listings point to versioned project releases. A purchase can become your own editable working copy without mutating the published release." },
    { title: "Own the code", body: "Export stays part of the product contract. The project should continue as a normal codebase outside Webcanbe." },
  ]},
  "/docs/getting-started": { title: "Getting started", eyebrow: "Getting Started", intro: "Move from marketplace release to editable project without introducing a second source of truth.", sections: [
    { title: "1. Browse", body: "Open Marketplace and inspect a working project release." },
    { title: "2. Create a working copy", body: "Your editable copy is created from the immutable release you selected." },
    { title: "3. Edit", body: "Use Visual, Code, or Split. Changes operate against the same project source." },
  ]},
  "/docs/customization": { title: "Customization", eyebrow: "Getting Started", intro: "Change appearance and structure while the project source remains authoritative.", sections: [
    { title: "Visual edits", body: "Use the visual workspace for layout, spacing, type, and supported style changes." },
    { title: "Code edits", body: "Open source directly when the visual layer is not the right tool for the change." },
  ]},
  "/docs/marketplace": { title: "Marketplace", eyebrow: "Product", intro: "Browse immutable releases of working web projects.", sections: [
    { title: "Listings", body: "Listings expose bounded public metadata and point to a specific release." },
    { title: "Release integrity", body: "A published release does not silently change underneath a purchase." },
  ]},
  "/docs/visual-editor": { title: "Visual editor", eyebrow: "Workspace", intro: "Edit the interface without replacing the underlying source with a proprietary canvas.", sections: [
    { title: "Source-backed selection", body: "Visual selections resolve to source-backed targets in the working revision." },
    { title: "Minimal patches", body: "Visual changes should produce minimal source edits and then reparse the project." },
  ]},
  "/docs/code-editor": { title: "Code editor", eyebrow: "Workspace", intro: "Open and edit the actual source in the same workspace.", sections: [
    { title: "Same project", body: "Code mode is not a generated copy of the visual project. It is the same working source." },
    { title: "Split mode", body: "Preview and source can stay side by side without introducing another canonical representation." },
  ]},
  "/docs/export": { title: "Export", eyebrow: "Ownership", intro: "Leave with the project source you have been editing.", sections: [
    { title: "Portable by design", body: "The exported project should continue in a normal local development workflow." },
    { title: "No runtime lock-in", body: "Webcanbe is not meant to remain in the runtime for the exported project to work." },
  ]},
  "/docs/compatibility": { title: "Compatibility", eyebrow: "Reference", intro: "Compatibility is explicit instead of being hidden behind conversion.", sections: [
    { title: "Current focus", body: "React/Vite projects with JSX or TSX, CSS, CSS Modules, inline styles, Flex, Grid, and Tailwind are the main target." },
    { title: "Separate dimensions", body: "Runtime support, visual editability, verification, security admission, export, and hosted readiness are tracked separately." },
  ]},
  "/docs/history": { title: "History", eyebrow: "Workspace", intro: "Keep track of accepted changes to your working project.", sections: [{ title: "One revision history", body: "Visual and code changes are saved against the same project source. Check that a save has completed before leaving your workspace." }, { title: "Review before continuing", body: "Use History to inspect earlier revisions. Export the current source when you want a portable copy for your own development workflow." }] },
  "/docs/security": { title: "Security", eyebrow: "Reference", intro: "Uploaded projects and hosted operations stay behind explicit authority boundaries.", sections: [
    { title: "Admission", body: "Uploaded package scripts, plugins, lifecycle hooks, and arbitrary installs are not executed during admission." },
    { title: "Authority", body: "Session, project, revision, and privileged operation boundaries are enforced server-side." },
  ]},
}

export const docsNav = [
  ["Getting Started", [["Introduction","/docs"],["Getting started","/docs/getting-started"],["Customization","/docs/customization"]]],
  ["Product", [["Marketplace","/docs/marketplace"],["Visual editor","/docs/visual-editor"],["Code editor","/docs/code-editor"],["History","/docs/history"],["Export","/docs/export"]]],
  ["Reference", [["Compatibility","/docs/compatibility"],["Security","/docs/security"],["Changelog","/changelog"]]],
] as const

