import { createClient } from '@supabase/supabase-js';
import { createAIGameHandler } from '../../../lib/aiGamesServer.js';

export const prerender = false;

export const POST = (context) => createAIGameHandler({
    env: process.env,
    createClient,
})(context);
