import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { getAudioStorageLocation } from './pieces.js';

async function execute(db, path) {
    await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('generated karaoke paths resolve to the private karaoke bucket while existing paths stay compatible', () => {
    assert.deepEqual(getAudioStorageLocation('karaoke-audio:negative/song/job.wav'), { bucket: 'karaoke-audio', path: 'negative/song/job.wav' });
    assert.deepEqual(getAudioStorageLocation('orga/song/negativ.mp3'), { bucket: 'academy-media', path: 'orga/song/negativ.mp3' });
    assert.equal(getAudioStorageLocation('karaoke-audio:'), null);
});

test('Audio processing queue migration is repeatable, private, and teacher-scoped', async () => {
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
        const migration = await readFile(new URL('../../supabase/migrations/20261021000002_audio_processing_queue.sql', import.meta.url), 'utf8');
        await db.exec(migration);
        await db.exec(migration);

        const catalog = await db.query(`
            select
                (select relrowsecurity from pg_class where oid = 'public.audio_processing_queue'::regclass) as rls_enabled,
                (select public from storage.buckets where id = 'karaoke-audio') as bucket_public,
                (select file_size_limit from storage.buckets where id = 'karaoke-audio') as bucket_limit,
                (select array_agg(enumlabel order by enumsortorder) from pg_enum where enumtypid = 'public.audio_processing_status'::regtype) as statuses
        `);
        assert.deepEqual(catalog.rows[0], {
            rls_enabled: true,
            bucket_public: false,
            bucket_limit: 524288000,
            statuses: ['pending', 'processing', 'completed', 'error'],
        });

        const serviceRoleAccess = await db.query("select has_table_privilege('service_role', 'public.audio_processing_queue', 'select,insert,update') as can_process");
        assert.equal(serviceRoleAccess.rows[0].can_process, true);

        const tablePolicies = await db.query(`
            select policyname, cmd from pg_policies
            where schemaname = 'public' and tablename = 'audio_processing_queue'
            order by policyname
        `);
        assert.deepEqual(tablePolicies.rows.map(({ policyname, cmd }) => [policyname, cmd]), [
            ['audio_processing_queue_teacher_insert', 'INSERT'],
            ['audio_processing_queue_teacher_read', 'SELECT'],
            ['audio_processing_queue_teacher_update', 'UPDATE'],
        ]);

        const storagePolicies = await db.query(`
            select policyname, cmd from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and policyname like 'karaoke_audio_%'
            order by policyname
        `);
        assert.deepEqual(storagePolicies.rows.map(({ policyname, cmd }) => [policyname, cmd]), [
            ['karaoke_audio_delete_teacher', 'DELETE'],
            ['karaoke_audio_insert_teacher', 'INSERT'],
            ['karaoke_audio_read', 'SELECT'],
            ['karaoke_audio_update_teacher', 'UPDATE'],
        ]);
        assert.match(migration, /alter publication supabase_realtime add table public\.audio_processing_queue/i);
        assert.match(migration, /audio_processing_queue_one_active_per_song_idx/);

        const songId = '11111111-1111-4111-8111-111111111111';
        const jobId = '22222222-2222-4222-8222-222222222222';
        await db.query("insert into public.pieces(id, discipline, title) values ($1, 'orga', 'Bridge test')", [songId]);
        await assert.rejects(
            db.query("insert into public.audio_processing_queue(song_id, original_url, status, result_url) values ($1, 'https://source.example/song.mp3', 'completed', 'karaoke-audio:negative/../outside.wav')", [songId]),
            /check constraint/i,
        );
        await assert.rejects(
            db.query("insert into public.audio_processing_queue(song_id, original_url, status) values ($1, 'https://source.example/song.mp3', 'error')", [songId]),
            /check constraint/i,
        );
        const valid = await db.query(
            "insert into public.audio_processing_queue(id, song_id, original_url, status, result_url) values ($1, $2, 'https://source.example/song.mp3', 'completed', $3) returning status",
            [jobId, songId, 'karaoke-audio:negative/' + songId + '/' + jobId + '.wav'],
        );
        assert.equal(valid.rows[0].status, 'completed');
    } finally {
        await db.close();
    }
});
