import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';
import { createLyricsHandler } from './handler.js';

Deno.serve(createLyricsHandler({ createClient, env: (name: string) => Deno.env.get(name) }));
