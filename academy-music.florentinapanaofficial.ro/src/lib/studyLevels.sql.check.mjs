import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const student = '11111111-1111-4111-8111-111111111111';
const teacher = '22222222-2222-4222-8222-222222222222';
async function execute(db, path) {
    await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('five-module migration preserves legacy data, teacher assignment and progressive media RLS', async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role;
            create schema auth;
            create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
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
            alter table profiles alter column study_level set default 'incepator';
            alter table pieces drop constraint pieces_level_check;
            alter table pieces add constraint pieces_level_check check(level in ('incepator','mediu','avansat'));
            insert into auth.users(id, raw_user_meta_data) values ('${student}', '{"full_name":"Elev test"}'),('${teacher}', '{"full_name":"Profesor test"}');
            update profiles set role='teacher',study_level='avansat' where id='${teacher}';
            insert into pieces(discipline,title,level,is_published,audio_negativ_path) values
              ('canto','Legacy beginner','incepator',true,'legacy/b.mp3'),
              ('canto','Legacy intermediate','mediu',true,'legacy/m.mp3'),
              ('orga','Legacy advanced','avansat',true,'legacy/a.mp3');
        `);
        await execute(db, '../../supabase/migrations/20261024000004_five_study_modules.sql');
        await execute(db, '../../supabase/migrations/20261024000004_five_study_modules.sql');
        assert.equal((await db.query('select study_level from profiles where id=$1', [student])).rows[0].study_level, 'modul_1');
        assert.equal((await db.query('select study_level from profiles where id=$1', [teacher])).rows[0].study_level, 'modul_4');
        assert.deepEqual((await db.query('select level from pieces order by title')).rows.map(row => row.level), ['modul_4', 'modul_1', 'modul_3']);
        await assert.rejects(db.query('update profiles set study_level=$1 where id=$2', ['modul_6', student]), /check constraint/);
        await assert.rejects(db.query("insert into pieces(discipline,title,level) values('canto','Invalid','mediu')"), /check constraint/);
        const ids = [];
        for (let rank = 1; rank <= 5; rank++) {
            const id = (await db.query("insert into pieces(discipline,title,level,is_published,audio_negativ_path) values('canto',$1,$2,true,$3) returning id", ['Module ' + rank, 'modul_' + rank, 'module/' + rank + '.mp3'])).rows[0].id;
            ids.push(id);
            await db.query('insert into student_pieces(student_id,piece_id) values($1,$2)', [student, id]);
            await db.query("insert into storage.objects(bucket_id,name) values('academy-media',$1)", ['module/' + rank + '.mp3']);
        }
        await db.exec('grant select on public.pieces, public.profiles, public.resources, storage.objects to authenticated; grant update(study_level) on profiles to authenticated; set role authenticated');
        for (const rank of [3, 1, 5, 2, 4]) {
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [teacher]);
            const saved = await db.query('update profiles set study_level=$1 where id=$2 returning study_level', ['modul_' + rank, student]);
            assert.equal(saved.rows[0].study_level, 'modul_' + rank);
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [student]);
            await assert.rejects(db.query('update profiles set study_level=$1 where id=$2', ['modul_' + (rank === 5 ? 1 : 5), student]), /numai de profesor/);
            const progress = (await db.query('select get_my_study_progress() value')).rows[0].value;
            assert.equal(progress.study_level, 'modul_' + rank);
            assert.equal(progress.next_level, rank < 5 ? 'modul_' + (rank + 1) : null);
            assert.equal(progress.next_level_unlocked, false);
            for (let pieceRank = 1; pieceRank <= 5; pieceRank++) assert.equal((await db.query('select can_access_piece($1) allowed', [ids[pieceRank - 1]])).rows[0].allowed, pieceRank <= rank);
        }
        for (let rank = 1; rank <= 5; rank++) {
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [teacher]);
            await db.query('update profiles set study_level=$1 where id=$2', ['modul_' + rank, student]);
            await db.exec('reset role');
            await db.query("select set_config('request.jwt.claim.sub','',false)");
            await db.query("insert into catalog_teme(student_id,student_name,title,piece_id,drive_url) values($1,'Elev test','Temă',$2,$3)", [student, ids[rank - 1], 'https://drive.google.com/file/d/audio' + rank + '/view']);
            await db.exec('set role authenticated');
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [student]);
            const progress = (await db.query('select get_my_study_progress() value')).rows[0].value;
            assert.equal(progress.assigned_count, 1);
            assert.equal(progress.completed_count, 1);
            assert.equal(progress.next_level_unlocked, rank < 5);
            for (let pieceRank = 1; pieceRank <= 5; pieceRank++) assert.equal((await db.query('select can_access_piece($1) allowed', [ids[pieceRank - 1]])).rows[0].allowed, pieceRank <= Math.min(5, rank + 1));
            assert.equal((await db.query("select name from storage.objects where name like 'module/%'")).rows.length, Math.min(5, rank + 1));
        }
    } finally { await db.close(); }
});
