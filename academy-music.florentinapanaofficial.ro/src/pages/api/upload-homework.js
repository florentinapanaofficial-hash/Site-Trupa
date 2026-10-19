import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { createHomeworkUpload } from '../../lib/homeworkUpload.js';

export const prerender = false;

export const ALL = ({ request }) => createHomeworkUpload({
    env: process.env,
    createClient,
    createDrive: ({ email, key }) => google.drive({
        version: 'v3',
        auth: new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive.file'] }),
    }),
})(request);