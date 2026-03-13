import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import DOMPurify from 'isomorphic-dompurify';
import { q as query } from '../../chunks/db_bBUj1s93.mjs';
export { renderers } from '../../renderers.mjs';

const prerender = false;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_AUDIO_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = /* @__PURE__ */ new Set(["audio/mpeg", "audio/mp3"]);
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    }
  });
}
const POST = async ({ request }) => {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Form data invalid." }, 400);
  }
  const file = formData.get("photo");
  const audioFile = formData.get("audio");
  const rawTitle = typeof formData.get("title") === "string" ? String(formData.get("title")) : "";
  const cleanedTitle = DOMPurify.sanitize(rawTitle, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  if (!(file instanceof File)) {
    return jsonResponse({ error: "Fisierul photo este obligatoriu." }, 400);
  }
  const fallbackTitle = file.name.replace(/\.[^/.]+$/, "").trim();
  const title = cleanedTitle || fallbackTitle;
  if (!title || title.length < 2 || title.length > 180) {
    return jsonResponse({ error: "Titlul este obligatoriu si trebuie sa aiba intre 2 si 180 de caractere." }, 400);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return jsonResponse({ error: "Tip de fisier invalid. Sunt permise doar JPG, PNG sau WebP." }, 400);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonResponse({ error: "Fisierul depaseste limita de 5MB." }, 400);
  }
  if (audioFile instanceof File) {
    const audioMime = audioFile.type.toLowerCase();
    const audioExtension = audioFile.name.toLowerCase().split(".").pop() ?? "";
    const isMp3ByExtension = audioExtension === "mp3";
    if (!ALLOWED_AUDIO_MIME_TYPES.has(audioMime) && !isMp3ByExtension) {
      return jsonResponse({ error: "Fisierul audio trebuie sa fie MP3." }, 400);
    }
    if (audioFile.size > MAX_AUDIO_FILE_SIZE_BYTES) {
      return jsonResponse({ error: "Fisierul audio depaseste limita de 4MB." }, 400);
    }
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const optimized = await sharp(buffer).rotate().flatten({ background: "#0b1024" }).resize({
      width: 1200,
      withoutEnlargement: true,
      fit: "inside"
    }).webp({ quality: 82 }).toBuffer();
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "community");
    await mkdir(uploadsDir, { recursive: true });
    const fileName = `${nanoid(12)}.webp`;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, optimized);
    const publicUrl = `/uploads/community/${fileName}`;
    if (!publicUrl.startsWith("/uploads/community/")) {
      return jsonResponse({ error: "Cale imagine invalidă." }, 500);
    }
    await query(
      "INSERT INTO gallery (titlu, imagine_url) VALUES (?, ?)",
      [title, publicUrl]
    );
    let audioUrl = "";
    if (audioFile instanceof File) {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const audioDir = path.join(process.cwd(), "public", "uploads", "audio");
      await mkdir(audioDir, { recursive: true });
      const audioFileName = `${fileName.replace(/\.[^.]+$/, "")}.mp3`;
      const audioPath = path.join(audioDir, audioFileName);
      await writeFile(audioPath, audioBuffer);
      audioUrl = `/uploads/audio/${audioFileName}`;
    }
    return jsonResponse({ success: true, url: publicUrl, title, audioUrl }, 201);
  } catch (error) {
    console.error("Eroare upload photo:", error);
    return jsonResponse({ error: "Eroare la procesarea imaginii." }, 500);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
