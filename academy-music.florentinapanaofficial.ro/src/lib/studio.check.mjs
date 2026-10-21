import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

async function execute(db, path) {
    await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('Virtual Studio migration is repeatable and keeps request/storage access scoped', async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role;
            create schema auth;
            create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create schema storage;
            create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
            alter table storage.objects enable row level security;
            create function storage.foldername(text) returns text[] language sql as $$
                select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]
            $$;
            create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
            create schema realtime;
            create table realtime.messages(extension text);
            create function realtime.topic() returns text language sql stable as $$ select 'academy:online' $$;
            grant usage on schema auth,storage,realtime to authenticated;
        `);
        await execute(db, '../../supabase/schema.sql');
        await execute(db, '../../supabase/migrations/20261021000001_virtual_studio.sql');
        await execute(db, '../../supabase/migrations/20261021000001_virtual_studio.sql');

        const catalog = await db.query(`
            select
                (select relrowsecurity from pg_class where oid = 'public.studio_requests'::regclass) as rls_enabled,
                (select public from storage.buckets where id = 'student_records') as bucket_public,
                (select file_size_limit from storage.buckets where id = 'student_records') as bucket_limit,
                (select array_agg(enumlabel order by enumsortorder) from pg_enum where enumtypid = 'public.studio_request_status'::regtype) as statuses
        `);
        assert.deepEqual(catalog.rows[0], {
            rls_enabled: true,
            bucket_public: false,
            bucket_limit: 209715200,
            statuses: ['pending', 'processing', 'completed'],
        });

        const tablePolicies = await db.query(`
            select policyname, cmd from pg_policies
            where schemaname = 'public' and tablename = 'studio_requests'
            order by policyname
        `);
        assert.deepEqual(tablePolicies.rows.map(({ policyname, cmd }) => [policyname, cmd]), [
            ['studio_requests_student_insert', 'INSERT'],
            ['studio_requests_student_notification_ack', 'UPDATE'],
            ['studio_requests_student_read', 'SELECT'],
            ['studio_requests_teacher_read', 'SELECT'],
            ['studio_requests_teacher_update', 'UPDATE'],
        ]);

        const storagePolicies = await db.query(`
            select policyname, cmd, qual from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and policyname like 'student_records_%'
            order by policyname
        `);
        assert.deepEqual(storagePolicies.rows.map(({ policyname, cmd }) => [policyname, cmd]), [
            ['student_records_mastered_delete_teacher', 'DELETE'],
            ['student_records_mastered_insert_teacher', 'INSERT'],
            ['student_records_raw_delete_own', 'DELETE'],
            ['student_records_raw_insert_own', 'INSERT'],
            ['student_records_read', 'SELECT'],
        ]);
        const rawDeletePolicy = storagePolicies.rows.find(({ policyname }) => policyname === 'student_records_raw_delete_own');
        assert.match(rawDeletePolicy.qual, /not\s*\(\s*exists/i);
        assert.match(rawDeletePolicy.qual, /\bstudio_requests\b/i);
    } finally {
        await db.close();
    }
});
