import DOMPurify from 'isomorphic-dompurify';
import { q as query } from '../../chunks/db_bBUj1s93.mjs';
import { c as checkOrigin } from '../../chunks/cors_Cr15qMIT.mjs';
export { renderers } from '../../renderers.mjs';

const prerender = false;
const COMMENT_WINDOW_MS = 6e4;
const lastCommentByIp = /* @__PURE__ */ new Map();
function jsonResponse(data, status = 200, corsOrigin = null) {
  const corsHeaders = corsOrigin !== null ? { "Access-Control-Allow-Origin": corsOrigin, "Vary": "Origin" } : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      ...corsHeaders
    }
  });
}
function resolveClientIp(request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [firstIp] = forwarded.split(",");
    return firstIp.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
function isRateLimited(ip) {
  const now = Date.now();
  for (const [key, value] of lastCommentByIp.entries()) {
    if (now - value > COMMENT_WINDOW_MS) {
      lastCommentByIp.delete(key);
    }
  }
  const lastCommentAt = lastCommentByIp.get(ip) ?? 0;
  if (now - lastCommentAt < COMMENT_WINDOW_MS) {
    return true;
  }
  lastCommentByIp.set(ip, now);
  return false;
}
function parsePostId(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
const OPTIONS = ({ request }) => {
  const cors = checkOrigin(request);
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": cors.origin ?? "",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
};
const POST = async ({ request }) => {
  const cors = checkOrigin(request);
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  let payload;
  const ip = resolveClientIp(request);
  if (isRateLimited(ip)) {
    return jsonResponse({ error: "Prea multe comentarii. Incearca din nou peste un minut." }, 429, cors.origin);
  }
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalid." }, 400, cors.origin);
  }
  const postId = parsePostId(payload.post_id);
  const numeUtilizatorRaw = payload.nume_utilizator ?? payload.nume;
  const textComentariuRaw = payload.text_comentariu ?? payload.comentariu;
  const numeUtilizator = typeof numeUtilizatorRaw === "string" ? numeUtilizatorRaw.trim() : "";
  const rawComentariu = typeof textComentariuRaw === "string" ? textComentariuRaw.trim() : "";
  const textComentariu = DOMPurify.sanitize(rawComentariu, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  }).trim();
  if (!postId || !numeUtilizator) {
    return jsonResponse({ error: "Campurile post_id si nume_utilizator sunt obligatorii." }, 400, cors.origin);
  }
  if (textComentariu.length === 0 || textComentariu.length > 500) {
    return jsonResponse({ error: "Comentariul nu poate fi gol si nu poate depasi 500 caractere." }, 400, cors.origin);
  }
  try {
    await query(
      "INSERT INTO comments (post_id, nume_utilizator, text_comentariu) VALUES (?, ?, ?)",
      [postId, numeUtilizator, textComentariu]
    );
    return jsonResponse({ success: true }, 201, cors.origin);
  } catch (error) {
    console.error("Eroare la salvarea comentariului:", error);
    return jsonResponse({ error: "Eroare interna la salvarea comentariului." }, 500, cors.origin);
  }
};
const GET = async ({ url, request }) => {
  const cors = checkOrigin(request);
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const postId = parsePostId(url.searchParams.get("post_id"));
  if (!postId) {
    return jsonResponse({ error: "Parametrul post_id este obligatoriu si trebuie sa fie numar intreg pozitiv." }, 400, cors.origin);
  }
  try {
    const rows = await query(
      `SELECT id, post_id, nume_utilizator, text_comentariu, data
       FROM comments
       WHERE post_id = ?
       ORDER BY data DESC`,
      [postId]
    );
    return jsonResponse({ comments: rows }, 200, cors.origin);
  } catch (error) {
    console.error("Eroare la citirea comentariilor:", error);
    return jsonResponse({ error: "Eroare interna la citirea comentariilor." }, 500, cors.origin);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  OPTIONS,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
