import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
    ACCESS_COOKIE,
    createSecurityBackend,
    jsonResponse,
    readAuthInput,
    SecurityError,
    securityFailure,
} from '../../../lib/securityServer.js';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

type WorkerEnv = {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    [key: string]: unknown;
};

type RuntimeLocals = {
    workerEnv?: WorkerEnv;
    cfContext?: unknown;
};

export function createUnlockUserHandler(clientFactory = createClient): APIRoute {
    return async ({ request, cookies, clientAddress, locals }) => {
        try {
            const input = await readAuthInput(request);
            if (typeof input.user_id !== 'string' || !UUID_PATTERN.test(input.user_id)) {
                throw new SecurityError('invalid_input', 400, 'ID-ul elevului este invalid.');
            }

            const token = cookies.get(ACCESS_COOKIE)?.value;
            if (!token) throw new SecurityError('unauthorized');

            const runtime = locals as typeof locals & RuntimeLocals;
            const env = runtime.workerEnv ?? {};
            const backend = createSecurityBackend(env, clientFactory);
            const authenticated = await backend.check(
                token,
                request,
                clientAddress,
                false,
                Boolean(runtime.cfContext),
            );
            const admin = clientFactory(env.VITE_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, CLIENT_OPTIONS);

            const { data: teacher, error: teacherError } = await admin
                .from('profiles')
                .select('role,is_active,is_locked')
                .eq('id', authenticated.user.id)
                .maybeSingle();
            if (teacherError) {
                console.error('[Academy admin] Teacher authorization lookup failed:', teacherError.code);
                throw new SecurityError('security_unavailable', 503);
            }
            if (!teacher?.is_active || teacher.is_locked || !['teacher', 'profesor'].includes(teacher.role)) {
                throw new SecurityError('forbidden', 403, 'Doar un profesor activ poate debloca elevi.');
            }

            const { data: student, error: studentError } = await admin
                .from('profiles')
                .select('id,role,is_locked')
                .eq('id', input.user_id)
                .maybeSingle();
            if (studentError) {
                console.error('[Academy admin] Student lookup failed:', studentError.code);
                throw new SecurityError('security_unavailable', 503);
            }
            if (!student) throw new SecurityError('student_not_found', 404, 'Elevul nu a fost găsit.');
            if (!['student', 'elev'].includes(student.role)) {
                throw new SecurityError('invalid_student', 400, 'Contul selectat nu aparține unui elev.');
            }
            if (!student.is_locked) {
                return jsonResponse({ success: true, message: 'Contul elevului era deja deblocat.' });
            }

            const { error: historyError } = await admin
                .from('user_security_logs')
                .delete()
                .eq('user_id', input.user_id);
            if (historyError) {
                console.error('[Academy admin] Failed to clear locked student IP history:', historyError.code);
                throw new SecurityError('security_unavailable', 503);
            }

            const { data: updated, error: updateError } = await admin
                .from('profiles')
                .update({ is_locked: false, active_session_id: null })
                .eq('id', input.user_id)
                .in('role', ['student', 'elev'])
                .select('id')
                .maybeSingle();
            if (updateError) {
                console.error('[Academy admin] Student unlock update failed:', updateError.code);
                throw new SecurityError('security_unavailable', 503);
            }
            if (!updated) throw new SecurityError('student_not_found', 404, 'Elevul nu a fost găsit.');

            return jsonResponse({ success: true, message: 'Contul elevului a fost deblocat.' });
        } catch (error) {
            return securityFailure(error);
        }
    };
}

export const POST = createUnlockUserHandler();
