// PostgreSQL-backed Supabase adapter used only in isolated tests; no live credentials.
export function aiGamesClient(db, transact = task => task()) {
    return () => ({
        async rpc(name, args) {
            if (!['ai_game_reserve','ai_game_answer'].includes(name)) throw new Error('Unexpected RPC: ' + name);
            return transact(async () => {
                try {
                    await db.exec('reset role; set role service_role;');
                    const keys = Object.keys(args);
                    const { rows } = await db.query('select public.' + name + '(' + keys.map((key, i) => key + '=>$' + (i + 1)).join(',') + ') as value', Object.values(args));
                    return { data: rows[0].value, error: null };
                } catch (error) { return { data: null, error }; }
            });
        },
        from(table) {
            if (table !== 'ai_game_sessions') throw new Error('Unexpected table');
            let updates; const filters = [];
            const builder = {
                update(value) { updates = value; return builder; },
                select() { return builder; },
                eq(column, value) { if (!['id','user_id','status'].includes(column)) throw new Error('Unexpected column'); filters.push([column, value]); return builder; },
                single() { return execute(); },
                maybeSingle() { return execute(); },
                then(resolve, reject) { return execute().then(resolve, reject); },
            };
            function execute() {
                return transact(async () => {
                    try {
                        await db.exec('reset role; set role service_role;');
                        const values = [];
                        const set = updates ? Object.entries(updates).map(([key, value]) => {
                            if (!['quiz','status'].includes(key)) throw new Error('Unexpected update');
                            values.push(key === 'quiz' ? JSON.stringify(value) : value);
                            return key + '=$' + values.length;
                        }).join(',') : '';
                        const where = filters.map(([key, value]) => { values.push(value); return key + '=$' + values.length; }).join(' and ');
                        const { rows } = await db.query((updates ? 'update public.ai_game_sessions set ' + set : 'select * from public.ai_game_sessions') + ' where ' + where + (updates ? ' returning *' : ''), values);
                        return { data: rows[0] || null, error: null };
                    } catch (error) { return { data: null, error }; }
                });
            }
            return builder;
        },
    });
}

export function sampleAIQuiz() {
    return { title: 'Antrenament de note', questions: Array.from({ length: 5 }, (_, index) => ({
        prompt: 'Exercițiul ' + (index + 1) + ': ce notă urmează după Do?',
        options: ['Re', 'Mi', 'Fa', 'Sol'], correctIndex: 0,
        explanation: 'În ordinea ascendentă a notelor naturale, după Do urmează Re.',
    })) };
}
export function aiProviderResponse(quiz = sampleAIQuiz()) {
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(quiz) } }] }), { headers: { 'Content-Type': 'application/json' } });
}
