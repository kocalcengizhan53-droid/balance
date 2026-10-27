import type { Plugin } from "vite"

/**
 * A lazy route opened directly costs a waterfall: the entry chunk downloads and runs, and only
 * then does the router ask for the page's chunk. On a phone that cost the fleet page six points
 * of Lighthouse. This plugin writes a few lines into index.html that start the current route's
 * chunks as `modulepreload`, in parallel with the entry. A route whose module produced no chunk
 * fails the build, so this table cannot drift from the router unnoticed.
 */
export function routePreload(routes: Record<string, string>): Plugin {
  return {
    name: "route-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        const chunks = Object.values(bundle).filter((c) => c.type === "chunk")
        const entry = chunks.find((c) => c.isEntry)
        const files = (
          fileName: string,
          seen = new Set<string>()
        ): string[] => {
          if (seen.has(fileName) || fileName === entry?.fileName) return []
          seen.add(fileName)
          const chunk = chunks.find((c) => c.fileName === fileName)
          return [
            fileName,
            ...(chunk?.imports ?? []).flatMap((f) => files(f, seen)),
          ]
        }
        const map = Object.fromEntries(
          Object.entries(routes).map(([path, module]) => {
            const chunk = chunks.find((c) => c.facadeModuleId?.endsWith(module))
            if (!chunk)
              throw new Error(`route-preload: no chunk for ${path} (${module})`)
            return [path, files(chunk.fileName)]
          })
        )
        const script =
          `(function(){var f=${JSON.stringify(map)}[location.pathname.replace(/\\/$/,"")];` +
          `if(f)f.forEach(function(s){var l=document.createElement("link");l.rel="modulepreload";l.href="/"+s;document.head.appendChild(l)})})()`
        return [{ tag: "script", children: script, injectTo: "head-prepend" }]
      },
    },
  }
}
