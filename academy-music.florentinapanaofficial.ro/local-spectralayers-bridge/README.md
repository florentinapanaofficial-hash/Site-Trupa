# Local SpectraLayers processing bridge

The bridge runs on the teacher's Windows PC. It listens for pending rows in `public.audio_processing_queue`, downloads the source, runs a configured local processor, uploads the result to the private `karaoke-audio` bucket, and marks the queue row completed. The Admin page uses Supabase Realtime to show progress and lets the teacher preview and explicitly assign the result as the piece's negative.

## Setup

1. Apply `supabase/migrations/20261021000002_audio_processing_queue.sql` to the Academy Supabase project.
2. Install Node.js 22.12 or newer, then run `npm install` in this folder.
3. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the project's trusted server-side credentials.
4. Set `SPECTRALAYERS_EXECUTABLE` and `SPECTRALAYERS_ARGS_JSON` for the installed SpectraLayers version or a locally installed wrapper. The JSON argument array must include `{input}` and `{output}`. Set `SPECTRALAYERS_OUTPUT_EXTENSION` to `mp3`, `wav`, `flac`, `aac`, `m4a` or `ogg`. The program must finish with a non-empty output file at the exact `{output}` path and use that extension.
5. Replace every angle-bracket placeholder in `.env`; the bridge refuses to start while placeholders remain. Add exact HTTPS source hostnames to `AUDIO_SOURCE_ALLOWED_HOSTS` when source audio is hosted outside the same Supabase project.
6. Run `npm test`, then `npm start`. Keep the process running while jobs are being submitted.

The bridge intentionally does not assume that `SpectraLayers.exe -batch` or any other CLI flags are supported. Confirm the automation/command syntax for the licensed SpectraLayers 12 edition and installed build before filling the arguments. This repository does not contain or claim an official Steinberg batch-separation command. A wrapper is acceptable if it invokes the licensed application and writes the expected output.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Supabase RLS and grants broad project access. It must remain only on the teacher's trusted PC, in this ignored local `.env` or a secure OS secret store; never place it in a `VITE_*` variable, browser bundle, repository, or issue. Rotate it if exposed.
- The SQL migration still enforces teacher-only access for browser users and assigns students read access only to the generated negative of a piece they can access. The local service-role worker is a trusted privileged process.
- External source URLs are fetched only over HTTPS from explicitly allow-listed hostnames, without following redirects. Supabase Storage sources are accepted only from the configured project's `academy-media` bucket.
- Temporary files are isolated in a unique OS temp folder and removed after each job. Queue failures are recorded as `error` with a readable message.
- `result_url` stores the private object locator `karaoke-audio:negative/<song-id>/<job-id>.<ext>`, not an expiring signed URL. The Admin UI signs it only when previewing.
