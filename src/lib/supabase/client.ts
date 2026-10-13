import { createBrowserClient } from '@/lib/neon/browser';

export { createBrowserClient, type BrowserAuthSession, type NeonError } from '@/lib/neon/browser';

export const createClient = createBrowserClient;
