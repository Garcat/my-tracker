// @ts-nocheck
import {
  createDatabaseClient,
  createSiteContext,
  errorResponse,
  BackendError,
} from './_qoder/backend.mjs';
import { application } from './routes.mjs';
import { createStateStore } from './store.mjs';

const handle = application({
  store: createStateStore(createDatabaseClient()),
  BackendError,
});

Deno.serve(async (request: Request) => {
  let context: ReturnType<typeof createSiteContext> | undefined;
  try {
    context = createSiteContext(request);
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});
