/**
 * Declarative / generative UI — how the homestay agent's output renders in chat.
 *
 * - `tools/`      — imperative renderers: `useRenderTool` / `useHumanInTheLoop` /
 *                   `useFrontendTool` for room + booking tools, plus the wildcard fallback
 * - `a2ui/`       — declarative A2UI catalog (agent emits a UI tree; rendered from a catalog)
 * - `config/`     — which tool calls are visible in chat vs page-only, silent-resolve rules
 * - `components/` — `UnknownToolRenderer`, shared success notice
 * - `types/`      — `ToolRendererProps`
 */
export * from "./tools";
export * from "./a2ui";
export * from "./config";
export * from "./components";
export * from "./types";
