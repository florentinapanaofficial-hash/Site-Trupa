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
        await execute(db, '../../supabase/migrations/20261021000003_studio_dry_notification_security.sql');
        await execute(db, '../../supabase/migrations/20261021000003_studio_dry_notification_security.sql');

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

        const student = '11111111-1111-4111-8111-111111111111';
        const other = '22222222-2222-4222-8222-222222222222';
        const teacher = '33333333-3333-4333-8333-333333333333';
        const song = '44444444-4444-4444-8444-444444444444';
        const requestId = '55555555-5555-4555-8555-555555555555';
        const pendingId = '66666666-6666-4666-8666-666666666666';
        await db.exec(`
            insert into auth.users(id) values ('${student}'), ('${other}'), ('${teacher}');
            update public.profiles set role='teacher' where id='${teacher}';
            insert into public.pieces(id,title,discipline,is_published) values ('${song}','Studio test','orga',true);
            insert into public.studio_requests(id,student_id,song_id,raw_audio_url,final_audio_url,status) values
                ('${requestId}','${student}','${song}','raw/take.webm','mastered/master.wav','completed'),
                ('${pendingId}','${student}','${song}','raw/take2.webm',null,'pending');
            set role authenticated; set request.jwt.claim.sub='${student}';
        `);
        const row = async () => (await db.query(`select * from public.studio_requests where id='${requestId}'`)).rows[0];
        const original = await row();
        for (const change of ["final_audio_url='forged'", "status='processing'", "status='pending'", "raw_audio_url='forged'", `song_id='${pendingId}'`, `student_id='${other}'`, `id='${other}'`, "created_at='2000-01-01'"]) {
            for (const ack of ['', ',notification_seen_at=now()']) {
                await assert.rejects(db.query(`update public.studio_requests set ${change}${ack} where id='${requestId}'`), /permission denied|notification_seen_at|row-level security/i);
                assert.deepEqual(await row(), original);
            }
        }
        const ack = async (id = requestId, value = 'now()') => db.query(`update public.studio_requests set notification_seen_at=${value} where id='${id}' returning *`);
        assert.equal((await ack(pendingId)).rows.length, 0);
        await db.exec(`set request.jwt.claim.sub='${other}'`);
        assert.equal((await ack()).rows.length, 0);
        await db.exec(`reset role; set request.jwt.claim.sub=''; update public.profiles set is_active=false where id='${student}'; set role authenticated; set request.jwt.claim.sub='${student}'`);
        assert.equal((await ack()).rows.length, 0);
        await db.exec(`reset role; set request.jwt.claim.sub=''; update public.profiles set is_active=true where id='${student}'; set role authenticated; set request.jwt.claim.sub='${student}'`);
        const acknowledged = (await ack(requestId, "'2000-01-01'")).rows[0];
        assert.ok(new Date(acknowledged.notification_seen_at).getUTCFullYear() > 2000);
        assert.deepEqual({ ...acknowledged, notification_seen_at: null }, original);
        assert.equal((await ack()).rows.length, 0);
        assert.equal((await ack(requestId, 'null')).rows.length, 0);
        await db.exec(`set request.jwt.claim.sub='${teacher}'`);
        assert.equal((await db.query(`update public.studio_requests set status='processing' where id='${pendingId}' returning status`)).rows[0].status, 'processing');
        assert.equal((await db.query(`update public.studio_requests set status='completed',final_audio_url='mastered/final.wav' where id='${pendingId}' returning status`)).rows[0].status, 'completed');
        // A permissive legacy policy must not bypass the column guard.
        await db.exec(`reset role; create policy legacy_permissive_update on public.studio_requests for update to authenticated using(true) with check(true); set role authenticated; set request.jwt.claim.sub='${student}'`);
        await assert.rejects(db.query(`update public.studio_requests set final_audio_url='forged',notification_seen_at=now() where id='${pendingId}'`), /notification_seen_at/);
        await assert.rejects(ack(requestId, 'null'), /notification_seen_at/);

    } finally {
        await db.close();
    }
});
