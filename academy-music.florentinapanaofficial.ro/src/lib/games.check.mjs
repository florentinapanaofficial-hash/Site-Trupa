import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { matchNote, rhythmScore } from './rhythm.js';
const ids = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const migration = await readFile(new URL('../../supabase/migrations/20261021000004_games_live.sql', import.meta.url),'utf8');
async function setup() {
    const db = new PGlite();
    await db.exec(        `create role anon; create role authenticated; create role service_role;
        create schema auth;
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        create table public.profiles(id uuid primary key,role text,is_active boolean,avatar_path text);
        create function public.academy_active() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and is_active)$$;
        create function public.is_teacher() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and role='teacher' and is_active)$$;
        create schema storage; create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
        grant usage on schema auth,storage to authenticated; grant select on storage.objects to authenticated;
        insert into public.profiles values ('${ids[0]}','student',true,'${ids[0]}/photo.webp'),('${ids[1]}','student',true,'${ids[1]}/photo.webp'),('${ids[2]}','student',true,null),('${ids[3]}','teacher',true,null);`);
    await db.exec(await readFile(new URL('../../supabase/setup_quizzes.sql', import.meta.url),'utf8'));
    await db.exec(migration); await db.exec(migration);
    await db.exec(`insert into public.quizzes(id,title,is_published) values ('ready','Quiz pregătit',true),('draft','Ciornă',false);
        insert into public.quiz_questions(quiz_id,prompt,options,correct_option,position) values ('ready','Do?', '["Do","Re"]',0,0),('ready','Re?', '["Do","Re"]',1,1),('draft','Ascuns?', '["A","B"]',0,0);`);
    return db;
}
async function as(db, id) { await db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`); }
async function rpc(db,name,...args) { return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value; }
async function admin(db,sql) { await db.exec('reset role;'); await db.exec(sql); }

test('shared rhythm matching preserves Studio window, closest note and duplicate protection',()=>{
    const notes=[{id:0,note:60,time:1},{id:1,note:60,time:1.2}];
    assert.equal(matchNote(notes,60,1.15,new Set()).id,1);
    assert.equal(matchNote(notes,60,1.15,new Set([1])).id,0);
    assert.equal(matchNote(notes,62,1,new Set()),null);
    assert.equal(matchNote(notes,60,1.181,new Set([1])),null);
    assert.equal(rhythmScore(12,0),1000); assert.equal(rhythmScore(1,10),0);
});

test('rhythm server recomputes score, locks attempts, rejects early/foreign/forged input and ranks only opted-in active students',async()=>{
    const db=await setup(); try {
        await as(db,ids[0]); const a=await rpc(db,'game_rhythm_start');
        await assert.rejects(()=>rpc(db,'game_rhythm_start'),/Așteaptă/);
        const events=a.pattern.map(n=>({note:n.note,time:n.time}));
        await assert.rejects(()=>rpc(db,'game_rhythm_finish',a.id,JSON.stringify(events)),/interval/);
        await assert.rejects(()=>db.exec(`update public.rhythm_attempts set score=1000 where id='${a.id}'`),/permission denied/);
        await admin(db,`update public.rhythm_attempts set started_at=clock_timestamp()-interval '15 seconds' where id='${a.id}'`);
        await as(db,ids[1]); await assert.rejects(()=>rpc(db,'game_rhythm_finish',a.id,'[]'),/disponibilă/);
        await as(db,ids[0]);
        await assert.rejects(()=>rpc(db,'game_rhythm_finish',a.id,'[{"time":-1,"note":60}]'),/invalide/);
        await assert.rejects(()=>rpc(db,'game_rhythm_finish',a.id,'[{"time":"1","note":60}]'),/invalide/);
        assert.equal((await rpc(db,'game_rhythm_finish',a.id,JSON.stringify(events))).score,1000);
        assert.equal((await rpc(db,'game_rhythm_finish',a.id,'[]')).score,1000);
        assert.deepEqual(await rpc(db,'game_leaderboard'),[]);
        await rpc(db,'game_set_profile','Artist A',true);
        await as(db,ids[1]); assert.equal((await rpc(db,'game_leaderboard'))[0].total,1000);
        await db.exec(`insert into storage.objects values ('avatars','${ids[0]}/photo.webp')`).then(()=>assert.fail('storage insert must fail'),e=>assert.match(e.message,/permission denied/));
        await admin(db,`insert into storage.objects values ('avatars','${ids[0]}/photo.webp');`);
        await as(db,ids[1]); assert.equal((await db.query('select * from storage.objects')).rows.length,1);
        await as(db,ids[0]); await rpc(db,'game_set_profile','Artist A',false);
        await as(db,ids[1]); assert.equal((await db.query('select * from storage.objects')).rows.length,0);
        assert.deepEqual(await rpc(db,'game_leaderboard'),[]);
        await admin(db,`update public.profiles set is_active=false where id='${ids[1]}'`); await as(db,ids[1]);
        await assert.rejects(()=>rpc(db,'game_leaderboard'),/Cont activ/);
        await db.exec('reset role; set role anon;'); await assert.rejects(()=>rpc(db,'game_live_state',a.id),/permission denied/);
    } finally {await db.close();}
});

test('prepared quizzes support targeted peer challenges, two players, hidden answer keys, automatic rounds and authoritative scoring',async()=>{
    const db=await setup(); try {
        await as(db,ids[1]); await rpc(db,'game_set_profile','Rival',true);
        await as(db,ids[0]); await rpc(db,'game_set_profile','Provocator',true);
        assert.equal((await rpc(db,'game_opponents'))[0].alias,'Rival');
        await assert.rejects(()=>rpc(db,'game_live_create','draft',ids[1],20),/indisponibil/);
        await admin(db,`insert into public.quizzes(id,title,is_published) values ('invalid','Format invalid',true);
          insert into public.quiz_questions(quiz_id,prompt,options,correct_option,position) values ('invalid','Ce notă?','[{},"Re"]',0,0);`);
        await as(db,ids[0]); await assert.rejects(()=>rpc(db,'game_live_create','invalid',ids[1],20),/invalide/);
        await assert.rejects(()=>rpc(db,'game_live_create','ready',ids[0],20),/Adversarul/);
        const r=await rpc(db,'game_live_create','ready',ids[1],20);
        assert.equal((await rpc(db,'game_live_state',r.id)).status,'lobby');
        await assert.rejects(()=>db.query('select correct_option from public.quiz_questions'),/permission denied/);
        await assert.rejects(()=>db.query('select * from public.live_quiz_questions'),/permission denied/);
        await assert.rejects(()=>db.exec(`insert into public.live_quiz_answers values ('${r.id}','${ids[0]}',0,0,100,now())`),/permission denied/);
        await as(db,ids[2]); await assert.rejects(()=>rpc(db,'game_live_join',r.code),/altui elev/);
        await assert.rejects(()=>rpc(db,'game_live_state',r.id),/accesibilă/);
        assert.equal((await db.query('select * from public.live_quiz_rooms')).rows.length,0);
        await as(db,ids[1]); assert.equal((await db.query('select * from public.live_quiz_rooms')).rows.length,1);
        assert.equal(await rpc(db,'game_live_join',r.code),r.id);
        assert.equal(await rpc(db,'game_live_join',r.code),r.id);
        const first=await rpc(db,'game_live_state',r.id); assert.equal(first.question.correct_option,null); assert.equal(first.players.length,2);
        await rpc(db,'game_live_answer',r.id,0,0);
        await assert.rejects(()=>rpc(db,'game_live_answer',r.id,0,1),/deja/);
        await as(db,ids[0]); assert.equal((await rpc(db,'game_live_state',r.id)).players.every(p=>p.points===0),true);
        await assert.rejects(()=>rpc(db,'game_live_answer',r.id,1,0),/nu mai acceptă/);
        await assert.rejects(()=>rpc(db,'game_live_answer',r.id,0,7),/invalidă/);
        await rpc(db,'game_live_answer',r.id,0,1);
        const review=await rpc(db,'game_live_state',r.id); assert.equal(review.status,'review'); assert.equal(review.question.correct_option,0);
        assert.equal(review.players.find(p=>p.user_id===ids[1]).points,100);
        await admin(db,`update public.live_quiz_rooms set review_until=clock_timestamp()-interval '1 second' where id='${r.id}'`); await as(db,ids[0]);
        assert.equal((await rpc(db,'game_live_state',r.id)).question_index,1);
        await rpc(db,'game_live_answer',r.id,1,1); await as(db,ids[1]); await rpc(db,'game_live_answer',r.id,1,1);
        await admin(db,`update public.live_quiz_rooms set review_until=clock_timestamp()-interval '1 second' where id='${r.id}'`); await as(db,ids[1]);
        assert.equal((await rpc(db,'game_live_state',r.id)).status,'completed');
        const leaders=await rpc(db,'game_leaderboard'); assert.equal(leaders[0].alias,'Rival'); assert.equal(leaders[0].quiz,1000); assert.equal(leaders[1].quiz,500);
        const open=await rpc(db,'game_live_create','ready',null,10);
        await as(db,ids[2]); await rpc(db,'game_live_join',open.code);
        await as(db,ids[0]); await assert.rejects(()=>rpc(db,'game_live_cancel',open.id),/anulată/);
        await admin(db,`update public.live_quiz_rooms set deadline=clock_timestamp()-interval '1 second' where id='${open.id}'`); await as(db,ids[2]);
        await assert.rejects(()=>rpc(db,'game_live_answer',open.id,0,0),/nu mai acceptă/);
        assert.equal((await rpc(db,'game_live_state',open.id)).status,'review');
        await as(db,ids[0]); const canceled=await rpc(db,'game_live_create','ready',ids[1],10);
        await as(db,ids[1]); await rpc(db,'game_live_cancel',canceled.id); await assert.rejects(()=>rpc(db,'game_live_join',canceled.code),/disponibilă/);
    } finally {await db.close();}
});

test('duel deadlines survive both browsers closing, invite cancellation/expiry is durable, snapshots and session guards stay authoritative',async()=>{
    const db=await setup(); try {
        await as(db,ids[0]); const room=await rpc(db,'game_live_create','ready',null,10);
        await as(db,ids[1]); await rpc(db,'game_live_join',room.code);
        await as(db,ids[0]); await rpc(db,'game_live_answer',room.id,0,0);
        await admin(db,`update public.quiz_questions set correct_option=1,prompt='Bibliotecă modificată' where quiz_id='ready' and position=0;
            update public.live_quiz_rooms set deadline=clock_timestamp()-interval '5 hours',created_at=clock_timestamp()-interval '6 hours' where id='${room.id}';`);
        await as(db,ids[0]); const inbox=await rpc(db,'game_live_inbox'); assert.equal(inbox.find(r=>r.id===room.id).status,'completed');
        const result=await rpc(db,'game_live_state',room.id);assert.equal(result.players.find(p=>p.user_id===ids[0]).points,100);
        await assert.rejects(()=>rpc(db,'game_live_answer',room.id,1,1),/nu mai acceptă/);
        await assert.rejects(()=>rpc(db,'game_live_advance',room.id),/permission denied/);
        const expired=await rpc(db,'game_live_create','ready',null,10);
        await admin(db,`update public.live_quiz_rooms set created_at=clock_timestamp()-interval '11 minutes' where id='${expired.id}'`);
        await as(db,ids[1]); await assert.rejects(()=>rpc(db,'game_live_join',expired.code),/disponibilă/);
        await as(db,ids[0]); assert.equal((await rpc(db,'game_live_state',expired.id)).status,'completed');
        await rpc(db,'game_live_create','ready',null,10); await rpc(db,'game_live_create','ready',null,10);await rpc(db,'game_live_create','ready',null,10);
        await assert.rejects(()=>rpc(db,'game_live_create','ready',null,10),/Prea multe/);
        await admin(db,`create or replace function public.academy_active() returns boolean language sql stable as $$select false$$;`);
        await as(db,ids[0]);await assert.rejects(()=>rpc(db,'game_live_inbox'),/Cont activ/);
        await assert.rejects(()=>rpc(db,'game_rhythm_start'),/Cont activ/);
        assert.equal((await db.query('select * from public.live_quiz_rooms')).rows.length,0);
    } finally {await db.close();}
});
