import { createClient } from '@supabase/supabase-js';
import { createHomeworkUpload } from '../../lib/homeworkUpload.js';

export const prerender = false;

export const ALL = ({ request, locals }) => createHomeworkUpload({
    env: locals?.workerEnv ?? {},
    createClient,
})(request);
