import { createClient } from '@supabase/supabase-js';
import { createHomeworkUpload } from '../../lib/homeworkUpload.js';

export const prerender = false;

export const ALL = ({ request }) => createHomeworkUpload({
    env: process.env,
    createClient,
    createDrive: async ({ email, key }) => {
        const { google } = await import('googleapis');
        return google.drive({
            version: 'v3',
            auth: new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive.file'] }),
        });
    },
})(request);
