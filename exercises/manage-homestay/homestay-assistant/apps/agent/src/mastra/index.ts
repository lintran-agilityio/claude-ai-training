import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';

import { AGENT_KEYS } from '@repo/constants';
import { duckDbPath, studioDbPath } from './db-paths';

import { homestayAssistant } from './agents/homestay-assistant';
import {
  createMastraServerAuthConfig,
  createMastraServerMiddleware,
} from './middleware';

/**
 * Studio-only Mastra instance (observability + DuckDB).
 * CopilotKit uses `runtime.ts` / `mastra-runtime.db` — not this store.
 */
export const mastra = new Mastra({
  agents: {
    [AGENT_KEYS.HOMESTAY_ASSISTANT]: homestayAssistant,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      url: `file:${studioDbPath}`,
    }),
    domains: {
      observability: await new DuckDBStore({
        path: duckDbPath,
      }).getStore("observability"),
    }
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
  server: {
    middleware: createMastraServerMiddleware(),
    auth: createMastraServerAuthConfig(),
  },
});
