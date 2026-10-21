import { createClient } from '@supabase/supabase-js';
import { execFile as execFileCallback } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const execFile = promisify(execFileCallback);
const SOURCE_BUCKET = 'academy-media';
const RESULT_BUCKET = 'karaoke-audio';
const RESULT_PREFIX = `${RESULT_BUCKET}:`;
const AUDIO_MIME_BY_EXTENSION = {
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
};
const EXTENSION_BY_MIME = Object.fromEntries(Object.entries(AUDIO_MIME_BY_EXTENSION).map(([extension, mime]) => [mime, extension]));

function parseSupabaseStorageUrl(value, supabaseUrl) {
    const url = new URL(value);
    if (url.origin !== new URL(supabaseUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:authenticated|public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const bucket = decodeURIComponent(match[1]);
    const objectPath = match[2].split('/').map(decodeURIComponent).join('/');
    if (bucket !== SOURCE_BUCKET || !objectPath || objectPath.split('/').some((part) => part === '.' || part === '..')) {
        throw new Error('The queue source must be an audio object in the academy-media bucket.');
    }
    return { bucket, objectPath };
}

function validateExternalSource(value, allowedHosts) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || !allowedHosts.has(url.hostname.toLowerCase())) {
        throw new Error(`External audio host is not allowed: ${url.hostname}`);
    }
    return url;
}

function expandArguments(template, inputPath, outputPath) {
    if (!Array.isArray(template) || template.some((argument) => typeof argument !== 'string')) {
        throw new Error('SPECTRALAYERS_ARGS_JSON must be a JSON array of strings.');
    }
    const joined = template.join('\n');
    if (!joined.includes('{input}') || !joined.includes('{output}')) {
        throw new Error('SPECTRALAYERS_ARGS_JSON must include both {input} and {output}.');
    }
    return template.map((argument) => argument.replaceAll('{input}', inputPath).replaceAll('{output}', outputPath));
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createLimitedStream(maxBytes) {
    let size = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            size += chunk.length;
            if (size > maxBytes) {
                callback(new Error(`Audio file exceeds AUDIO_MAX_FILE_BYTES (${maxBytes}).`));
                return;
            }
            callback(null, chunk);
        },
    });
}

function extensionFor(sourcePath, mimeType = '') {
    const extension = path.extname(sourcePath).toLowerCase();
    if (AUDIO_MIME_BY_EXTENSION[extension]) return extension;
    const mime = mimeType.split(';', 1)[0].trim().toLowerCase();
    const fromMime = EXTENSION_BY_MIME[mime];
    if (fromMime) return fromMime;
    throw new Error('The source audio format is not a supported audio MIME type or extension.');
}

async function downloadSource(client, sourceUrl, config, destination) {
    const storageObject = parseSupabaseStorageUrl(sourceUrl, config.supabaseUrl);
    if (storageObject) {
        const { data, error } = await client.storage.from(storageObject.bucket).download(storageObject.objectPath);
        if (error || !data) throw new Error(`Supabase source download failed: ${error?.message || 'empty response'}`);
        if (data.size > config.maxFileBytes) throw new Error(`Audio file exceeds AUDIO_MAX_FILE_BYTES (${config.maxFileBytes}).`);
        const extension = extensionFor(storageObject.objectPath, data.type);
        await pipeline(Readable.fromWeb(data.stream()), createLimitedStream(config.maxFileBytes), createWriteStream(destination, { flags: 'wx' }));
        return extension;
    }

    const url = validateExternalSource(sourceUrl, config.allowedHosts);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
    if (!response.ok || !response.body) throw new Error(`External source download failed with HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > config.maxFileBytes) {
        throw new Error(`Audio file exceeds AUDIO_MAX_FILE_BYTES (${config.maxFileBytes}).`);
    }
    const extension = extensionFor(url.pathname, response.headers.get('content-type') || '');
    await pipeline(Readable.fromWeb(response.body), createLimitedStream(config.maxFileBytes), createWriteStream(destination, { flags: 'wx' }));
    return extension;
}

function loadConfig(env = process.env) {
    const supabaseUrl = env.SUPABASE_URL?.trim();
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const executable = env.SPECTRALAYERS_EXECUTABLE?.trim();
    if (!supabaseUrl || !serviceKey || !executable) {
        throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SPECTRALAYERS_EXECUTABLE in the local .env file.');
    }
    let argsTemplate;
    try {
        argsTemplate = JSON.parse(env.SPECTRALAYERS_ARGS_JSON || '[]');
    } catch (error) {
        throw new Error(`SPECTRALAYERS_ARGS_JSON is not valid JSON: ${error.message}`);
    }
    if (Array.isArray(argsTemplate) && argsTemplate.some((argument) => typeof argument === 'string' && /<[^>]+>/.test(argument))) {
        throw new Error('Replace the SpectraLayers angle-bracket placeholders with verified command arguments before starting.');
    }
    const outputExtension = `.${(env.SPECTRALAYERS_OUTPUT_EXTENSION || 'wav').trim().replace(/^\./, '').toLowerCase()}`;
    if (!AUDIO_MIME_BY_EXTENSION[outputExtension]) throw new Error('SPECTRALAYERS_OUTPUT_EXTENSION must be mp3, wav, flac, aac, m4a or ogg.');
    const allowedHosts = new Set((env.AUDIO_SOURCE_ALLOWED_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
    return {
        supabaseUrl,
        serviceKey,
        executable,
        argsTemplate,
        outputExtension,
        allowedHosts,
        timeoutMs: parsePositiveInteger(env.SPECTRALAYERS_TIMEOUT_MS, 3_600_000),
        maxFileBytes: parsePositiveInteger(env.AUDIO_MAX_FILE_BYTES, 524_288_000),
    };
}

async function markFailed(client, jobId, cause) {
    const message = (cause instanceof Error ? cause.message : String(cause)).slice(0, 1000);
    const { data, error } = await client.from('audio_processing_queue')
        .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'processing')
        .select('id')
        .maybeSingle();
    if (error) throw new Error(`Could not mark audio job ${jobId} as error: ${error.message}`);
    if (!data) throw new Error(`Audio job ${jobId} was no longer processing; error state was not changed.`);
}

async function processJob(client, job, config) {
    const { data: claimed, error: claimError } = await client.from('audio_processing_queue')
        .update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'pending')
        .select('id, song_id, original_url')
        .maybeSingle();
    if (claimError) throw new Error(`Could not claim audio job ${job.id}: ${claimError.message}`);
    if (!claimed) return;

    let workingDirectory = '';
    let uploadedPath = '';
    try {
        workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'academy-karaoke-'));
        const sourcePath = new URL(claimed.original_url).pathname;
        let inputPath = path.join(workingDirectory, `source${path.extname(sourcePath) || '.audio'}`);
        const sourceExtension = await downloadSource(client, claimed.original_url, config, inputPath);
        if (path.extname(inputPath).toLowerCase() !== sourceExtension) {
            const renamedInput = path.join(workingDirectory, `source${sourceExtension}`);
            await rename(inputPath, renamedInput);
            inputPath = renamedInput;
        }
        const outputPath = path.join(workingDirectory, `negative${config.outputExtension}`);
        const args = expandArguments(config.argsTemplate, inputPath, outputPath);
        console.info(`[audio-bridge] Running processor for job ${claimed.id}.`);
        const result = await execFile(config.executable, args, {
            windowsHide: true,
            timeout: config.timeoutMs,
            maxBuffer: 5 * 1024 * 1024,
        });
        if (result.stderr?.trim()) console.info(`[audio-bridge] Processor stderr: ${result.stderr.trim().slice(0, 2000)}`);
        const output = await stat(outputPath);
        if (!output.isFile() || output.size === 0) throw new Error('SpectraLayers did not create the expected non-empty output file.');
        if (output.size > config.maxFileBytes) throw new Error(`Processed audio exceeds AUDIO_MAX_FILE_BYTES (${config.maxFileBytes}).`);

        uploadedPath = `negative/${claimed.song_id}/${claimed.id}${config.outputExtension}`;
        const { error: uploadError } = await client.storage.from(RESULT_BUCKET).upload(uploadedPath, await readFile(outputPath), {
            contentType: AUDIO_MIME_BY_EXTENSION[config.outputExtension],
            upsert: false,
        });
        if (uploadError) throw new Error(`Processed audio upload failed: ${uploadError.message}`);

        const resultUrl = `${RESULT_PREFIX}${uploadedPath}`;
        const { data: completed, error: completeError } = await client.from('audio_processing_queue')
            .update({ status: 'completed', result_url: resultUrl, error_message: null, updated_at: new Date().toISOString() })
            .eq('id', claimed.id)
            .eq('status', 'processing')
            .select('id')
            .maybeSingle();
        if (completeError || !completed) throw new Error(`Could not complete audio job: ${completeError?.message || 'job state changed unexpectedly'}`);
        console.info(`[audio-bridge] Job ${claimed.id} completed. The teacher can preview and assign the result in Admin.`);
    } catch (cause) {
        if (uploadedPath) {
            const { error: removeError } = await client.storage.from(RESULT_BUCKET).remove([uploadedPath]);
            if (removeError) console.error(`[audio-bridge] Could not remove incomplete upload for job ${claimed.id}: ${removeError.message}`);
        }
        try {
            await markFailed(client, claimed.id, cause);
        } catch (stateError) {
            console.error(`[audio-bridge] ${stateError.message}`);
        }
        console.error(`[audio-bridge] Job ${claimed.id} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
        if (workingDirectory) {
            try {
                await rm(workingDirectory, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error(`[audio-bridge] Could not remove temporary directory for job ${claimed.id}: ${cleanupError.message}`);
            }
        }
    }
}

async function main() {
    const config = loadConfig();
    await access(config.executable);
    expandArguments(config.argsTemplate, 'C:\\input.wav', 'C:\\output.wav');
    const client = createClient(config.supabaseUrl, config.serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const staleBefore = new Date(Date.now() - config.timeoutMs - 60_000).toISOString();
    const { error: reclaimError } = await client.from('audio_processing_queue')
        .update({ status: 'pending', error_message: 'Requeued after the previous local worker timed out.', updated_at: new Date().toISOString() })
        .eq('status', 'processing')
        .lt('updated_at', staleBefore);
    if (reclaimError) throw new Error(`Could not recover stale audio jobs: ${reclaimError.message}`);

    let work = Promise.resolve();
    const queue = (job) => {
        work = work.then(() => processJob(client, job, config)).catch((error) => {
            console.error(`[audio-bridge] Queue worker error: ${error instanceof Error ? error.message : String(error)}`);
        });
    };
    const channel = client.channel('audio-processing-queue')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'audio_processing_queue',
            filter: 'status=eq.pending',
        }, ({ new: job }) => queue(job))
        .subscribe((status, error) => {
            if (status === 'SUBSCRIBED') console.info('[audio-bridge] Connected. Waiting for pending audio jobs.');
            else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
                console.error(`[audio-bridge] Realtime ${status}${error?.message ? `: ${error.message}` : ''}`);
            }
        });

    const { data: pending, error } = await client.from('audio_processing_queue')
        .select('id, song_id, original_url, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
    if (error) throw new Error(`Could not load pending audio jobs: ${error.message}`);
    for (const job of pending || []) queue(job);
    console.info(`[audio-bridge] Startup scan queued ${(pending || []).length} pending job(s).`);

    const shutdown = async () => {
        console.info('[audio-bridge] Shutting down after queued work finishes.');
        await work;
        await client.removeChannel(channel);
        process.exit(0);
    };
    process.once('SIGINT', () => { void shutdown(); });
    process.once('SIGTERM', () => { void shutdown(); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(`[audio-bridge] Startup failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    });
}

export { expandArguments, loadConfig, parseSupabaseStorageUrl, validateExternalSource };
