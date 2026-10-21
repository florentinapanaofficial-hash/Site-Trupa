import test from 'node:test';
import assert from 'node:assert/strict';
import { expandArguments, loadConfig, parseSupabaseStorageUrl, validateExternalSource } from './bridge.js';

test('parses private academy-media object URLs without accepting other Supabase buckets', () => {
    const source = 'https://project.example/storage/v1/object/authenticated/academy-media/orga/song%20one/voice.mp3?token=secret';
    assert.deepEqual(parseSupabaseStorageUrl(source, 'https://project.example'), {
        bucket: 'academy-media',
        objectPath: 'orga/song one/voice.mp3',
    });
    assert.equal(parseSupabaseStorageUrl('https://other.example/audio.mp3', 'https://project.example'), null);
    assert.throws(
        () => parseSupabaseStorageUrl('https://project.example/storage/v1/object/authenticated/avatars/user/photo.png', 'https://project.example'),
        /academy-media bucket/,
    );
});

test('restricts external download hosts and requires HTTPS without embedded credentials', () => {
    const allowed = new Set(['media.example.com']);
    assert.equal(validateExternalSource('https://media.example.com/song.mp3', allowed).hostname, 'media.example.com');
    assert.throws(() => validateExternalSource('https://other.example/song.mp3', allowed), /not allowed/);
    assert.throws(() => validateExternalSource('https://media.example.com:8443/song.mp3', allowed), /not allowed/);
    assert.throws(() => validateExternalSource('http://media.example.com/song.mp3', allowed), /not allowed/);
    assert.throws(() => validateExternalSource('https://user:pass@media.example.com/song.mp3', allowed), /not allowed/);
});

test('expands Windows paths as individual process arguments and requires both placeholders', () => {
    assert.deepEqual(expandArguments(['--source', '{input}', '--export', '{output}'], 'C:\\Temp Files\\in.mp3', 'C:\\Temp Files\\out.mp3'), [
        '--source', 'C:\\Temp Files\\in.mp3', '--export', 'C:\\Temp Files\\out.mp3',
    ]);
    assert.throws(() => expandArguments(['{input}'], 'in.mp3', 'out.mp3'), /both \{input\} and \{output\}/);
});

test('requires configured verified CLI arguments and a supported output format', () => {
    const env = {
        SUPABASE_URL: 'https://project.example',
        SUPABASE_SERVICE_ROLE_KEY: 'local-test-only',
        SPECTRALAYERS_EXECUTABLE: 'C:\\Program Files\\SpectraLayers.exe',
        SPECTRALAYERS_ARGS_JSON: '["--input","{input}","--output","{output}"]',
    };
    assert.equal(loadConfig(env).outputExtension, '.wav');
    assert.throws(() => loadConfig({ ...env, SPECTRALAYERS_ARGS_JSON: '["<VERIFIED_OPTION>","{input}","{output}"]' }), /placeholders/);
    assert.throws(() => loadConfig({ ...env, SPECTRALAYERS_OUTPUT_EXTENSION: 'exe' }), /must be mp3, wav/);
});
