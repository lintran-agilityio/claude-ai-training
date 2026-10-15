/**
 * Chatbot feature — the CopilotKit assistant experience.
 *
 * Layout:
 * - `provider.tsx`  — <ChatbotProvider>: Clerk gating + <CopilotKitProvider>
 * - `components/`    — chat shell, message renderers, suggestion bar
 * - `copilot/`       — CopilotKit ⇄ app wiring (tool providers, readables, a2ui, generative-UI config)
 * - `threads/`       — conversation thread list / sidebar / CRUD
 * - `hooks/` `stores/` `constants/` `types/` `utils/` — chat state + helpers
 *
 * Deep imports (`@/features/chatbot/<sub>/...`) stay the norm inside the app;
 * this barrel only surfaces the feature's outermost entry points.
 */
export { default as ChatbotProvider } from "./provider";
export * from "./components";
