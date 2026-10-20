import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const student = '11111111-1111-4111-8111-111111111111';
const pieces = {
    beginnerOne: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    beginnerTwo: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    intermediate: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    advanced: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
};

async function execute(db, path) {
    await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('server unlocks the next level only after each assigned current-level piece has a submitted audio/video task', async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated;
            create schema auth;
            create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create schema storage;
            create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
            alter table storage.objects enable row level security;
            create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
            create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
            create schema realtime;
            create table realtime.messages(extension text);
            create function realtime.topic() returns text language sql stable as $$ select 'academy:online' $$;
            grant usage on schema auth,storage,realtime to authenticated;
        `);
        await execute(db, '../../supabase/schema.sql');
        await execute(db, '../../supabase/migrations/20261020000007_study_levels_presence.sql');
        await db.exec(`
            insert into auth.users(id, raw_user_meta_data) values ('${student}', '{"full_name":"Elev test"}');
            insert into public.pieces(id, discipline, title, level, is_published, audio_negativ_path) values
                ('${pieces.beginnerOne}', 'orga', 'Piesa debut 1', 'incepator', true, 'media/b1.mp3'),
                ('${pieces.beginnerTwo}', 'orga', 'Piesa debut 2', 'incepator', true, 'media/b2.mp3'),
                ('${pieces.intermediate}', 'orga', 'Piesa medie', 'mediu', true, 'media/m1.mp3'),
                ('${pieces.advanced}', 'orga', 'Piesa avansată', 'avansat', true, 'media/a1.mp3');
            insert into public.student_pieces(student_id, piece_id) values
                ('${student}', '${pieces.beginnerOne}'), ('${student}', '${pieces.beginnerTwo}');
            insert into public.catalog_teme(student_id, student_name, title, piece_id, drive_url)
                values ('${student}', 'Elev test', 'Temă audio 1', '${pieces.beginnerOne}', 'https://drive.google.com/file/d/audio1/view');
            insert into public.submissions(student_id, piece_id, title, media_path, media_type)
                values ('${student}', '${pieces.beginnerTwo}', 'Temă video 2', 'portfolio/video2.mp4', 'video');
            insert into storage.objects(bucket_id, name) values
                ('academy-media', 'media/m1.mp3'), ('academy-media', 'media/a1.mp3');
        `);
        await db.exec(`set request.jwt.claim.sub = '${student}';`);
        const progress = (await db.query('select public.get_my_study_progress() as value')).rows[0].value;
        assert.equal(progress.assigned_count, 2);
        assert.equal(progress.completed_count, 2);
        assert.equal(progress.next_level_unlocked, true);
        assert.equal((await db.query(`select public.can_access_piece('${pieces.intermediate}') as allowed`)).rows[0].allowed, true);
        assert.equal((await db.query(`select public.can_access_piece('${pieces.advanced}') as allowed`)).rows[0].allowed, false);
        await db.exec('grant select on public.pieces, public.resources, storage.objects to authenticated');
        await db.exec('set role authenticated;');
        const visiblePieces = await db.query('select id from public.pieces where is_published');
        assert.equal(visiblePieces.rows.length, 4, 'all published metadata is visible');
        const visibleMedia = await db.query("select name from storage.objects where name in ('media/m1.mp3','media/a1.mp3') order by name");
        assert.deepEqual(visibleMedia.rows.map((row) => row.name), ['media/m1.mp3'], 'only current and automatically unlocked levels can fetch media');
    } finally {
        await db.close();
    }
});
