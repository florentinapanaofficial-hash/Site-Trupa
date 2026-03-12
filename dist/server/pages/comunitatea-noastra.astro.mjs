/* empty css                                               */
import { g as createComponent, j as renderComponent, r as renderTemplate, m as maybeRenderHead, i as addAttribute } from '../chunks/astro/server_CJG6WAvb.mjs';
import 'kleur/colors';
import { s as siteContent, $ as $$BaseLayout } from '../chunks/BaseLayout_DIWTYu9n.mjs';
import { q as query } from '../chunks/db_bBUj1s93.mjs';
/* empty css                                               */
export { renderers } from '../renderers.mjs';

const communityPosts = [
	{
		id: "post-new-ozpbtdozwqo",
		title: "Clip nou adăugat în comunitate",
		caption: "Un nou moment de pe canalul oficial. Dacă îți place atmosfera, dă like, comentează și distribuie postarea.",
		youtubeUrl: "https://www.youtube.com/watch?v=ozpbtDoZwQo",
		source: "Canal YouTube",
		publishedLabel: "acum"
	},
	{
		id: "post-new-aukj2x3ilwg",
		title: "Postare nouă din canalul oficial",
		caption: "Clip nou pentru comunitatea noastră. Dacă îți place acest moment, lasă un comentariu și distribuie-l mai departe.",
		youtubeUrl: "https://www.youtube.com/watch?v=aUkJ2x3Ilwg",
		source: "Canal YouTube",
		publishedLabel: "acum"
	},
	{
		id: "post-new-fd-cobiwus",
		title: "Moment nou live pentru comunitate",
		caption: "Încă un clip nou din canal. Dă like dacă îți place momentul și distribuie postarea pe social media.",
		youtubeUrl: "https://www.youtube.com/watch?v=_fd_coBIwus",
		source: "Canal YouTube",
		publishedLabel: "acum"
	},
	{
		id: "post-new-sibkjurdvmq",
		title: "Clip nou din repertoriul live",
		caption: "Un nou moment live pentru comunitate. Dacă îți place interpretarea, lasă un like și distribuie clipul.",
		youtubeUrl: "https://www.youtube.com/watch?v=SIbKjUrDvmQ",
		source: "Canal YouTube",
		publishedLabel: "acum"
	},
	{
		id: "post-new-izdm9qo-tw",
		title: "Noul clip live din comunitate",
		caption: "Clip nou adăugat în comunitate. Dacă îți place momentul, lasă un like, scrie un comentariu și distribuie postarea.",
		youtubeUrl: "https://www.youtube.com/watch?v=iZDM9_qO_tw",
		source: "Canal YouTube",
		publishedLabel: "acum"
	},
	{
		id: "post-live-populara-01",
		title: "Muzică populară - moment live",
		caption: "Un moment autentic de petrecere, cu energie bună și atmosferă caldă. Dacă îți place, dă like și distribuie mai departe.",
		youtubeUrl: "https://www.youtube.com/watch?v=aDB9Aa9cFLY",
		source: "Galerie video",
		publishedLabel: "1 h"
	},
	{
		id: "post-live-populara-02",
		title: "Muzică populară - energie de petrecere",
		caption: "Public implicat, vibe de sărbătoare și ritm susținut. Spune-ne în comentarii cum ți se pare acest moment.",
		youtubeUrl: "https://www.youtube.com/watch?v=LSd5N1AmiFg",
		source: "Galerie video",
		publishedLabel: "2 h"
	},
	{
		id: "post-live-populara-03",
		title: "Muzică populară - recital live",
		caption: "Un recital live plin de emoție și profesionalism. Ajută-ne cu un share ca să ajungem la mai mulți oameni.",
		youtubeUrl: "https://www.youtube.com/watch?v=OSrEJczdKuw",
		source: "Galerie video",
		publishedLabel: "4 h"
	},
	{
		id: "post-live-usoara-01",
		title: "Muzică ușoară - moment live",
		caption: "Interpretare live cu vibe elegant și atmosferă modernă. Like-ul tău ne motivează să postăm și mai des.",
		youtubeUrl: "https://www.youtube.com/watch?v=xdcdjAtxZlA",
		source: "Galerie video",
		publishedLabel: "6 h"
	},
	{
		id: "post-live-usoara-02",
		title: "Muzică ușoară - atmosferă live",
		caption: "Clip dintr-un eveniment în care energia publicului a fost la maximum. Lasă un comentariu cu melodia ta preferată.",
		youtubeUrl: "https://www.youtube.com/watch?v=FyrQQqFMZvg",
		source: "Galerie video",
		publishedLabel: "8 h"
	},
	{
		id: "post-tv-2025-invitat",
		title: "Apariție TV - Invitat special",
		caption: "Moment TV cu impact și reacții foarte bune din partea publicului. Distribuie postarea dacă ți-a plăcut.",
		youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
		source: "Apariții TV 2025",
		publishedLabel: "12 h"
	},
	{
		id: "post-tv-2024-gala",
		title: "Apariție TV - Gala Muzicii Live",
		caption: "Recital TV în formulă completă, cu accent pe calitate și prezență scenică. Dă like și trimite clipul prietenilor.",
		youtubeUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
		source: "Apariții TV 2024",
		publishedLabel: "1 zi"
	},
	{
		id: "post-tv-2023-portret",
		title: "Apariție TV - Portret de Artist",
		caption: "Interviu și moment muzical într-un format TV special. Comentariile tale ne ajută să creștem comunitatea.",
		youtubeUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
		source: "Apariții TV 2023",
		publishedLabel: "2 zile"
	}
];

const prerender = false;
const $$ComunitateaNoastra = createComponent(async ($$result, $$props, $$slots) => {
  const { brand, seo, videos, tvAppearances, contact } = siteContent;
  const getYoutubeId = (url) => {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return match?.[1] ?? "";
  };
  const getFeedType = (source) => source.toLowerCase().includes("apari") ? "tv" : "gallery";
  const whatsappNumber = contact.phoneRaw.replace(/\D/g, "");
  const buildWhatsAppCta = (videoUrl) => {
    const message = encodeURIComponent(`Bun\u0103! Vreau ofert\u0103 pentru sezonul 2026-2027. Am v\u0103zut aceast\u0103 postare: ${videoUrl}`);
    return `https://wa.me/${whatsappNumber}?text=${message}`;
  };
  const fallbackFeedPosts = [
    ...videos.map((item, index) => ({
      id: `video-${item.youtubeId}`,
      title: item.title,
      caption: `Atmosfer\u0103 real\u0103 din evenimentele noastre. Dac\u0103 \xEE\u021Bi place vibe-ul, d\u0103 like, comenteaz\u0103 \u0219i distribuie mai departe.`,
      youtubeId: item.youtubeId,
      youtubeUrl: item.youtubeUrl ?? `https://www.youtube.com/watch?v=${item.youtubeId}`,
      source: "Galerie video",
      publishedLabel: `${index + 1} h`
    })),
    ...tvAppearances.map((item, index) => {
      const youtubeId = getYoutubeId(item.videoUrl);
      if (!youtubeId) return null;
      return {
        id: `tv-${youtubeId}-${index + 1}`,
        title: item.show,
        caption: `Apari\u021Bie TV ${item.year}. Sus\u021Bine-ne cu un like \u0219i un share ca s\u0103 ajungem la c\xE2t mai mul\u021Bi clien\u021Bi noi.`,
        youtubeId,
        youtubeUrl: item.videoUrl,
        source: `Apari\u021Bii TV ${item.year}`,
        publishedLabel: `${index + 2} h`
      };
    }).filter(Boolean)
  ];
  const adminFeedPosts = (communityPosts ?? []).map((item, index) => {
    const imageUrl = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
    const youtubeId = getYoutubeId(item.youtubeUrl ?? "");
    if (!youtubeId && !imageUrl) return null;
    return {
      id: item.id || `admin-post-${index + 1}`,
      title: item.title || `Postare ${index + 1}`,
      caption: item.caption || "Postare comunitate.",
      youtubeId,
      youtubeUrl: item.youtubeUrl || "",
      imageUrl,
      source: item.source || "Comunitate",
      publishedLabel: item.publishedLabel || `${index + 1} h`
    };
  }).filter(Boolean);
  const feedPosts = adminFeedPosts.length > 0 ? adminFeedPosts : fallbackFeedPosts;
  let galleryPhotos = [];
  try {
    const rows = await query(
      `SELECT id, titlu, imagine_url, data_upload
     FROM gallery
     WHERE imagine_url LIKE '/uploads/%'
     ORDER BY data_upload DESC`
    );
    galleryPhotos = rows.filter((row) => typeof row.imagine_url === "string" && row.imagine_url.startsWith("/uploads/"));
  } catch (error) {
    console.error("Nu s-a putut citi galeria foto din DB:", error);
  }
  const pageTitle = `Comunitatea noastr\u0103 | ${brand.name}`;
  const pageDescription = "Distribuie videoclipurile preferate, interac\u021Bioneaz\u0103 cu comunitatea \u0219i sus\u021Bine forma\u021Bia prin like-uri \u0219i share-uri.";
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": pageTitle, "description": pageDescription, "ogImage": seo.ogImage, "data-astro-cid-46mpiyzq": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="section-container pt-8 pb-6 sm:pt-10" data-astro-cid-46mpiyzq> <header class="section-head mx-auto text-center" data-astro-cid-46mpiyzq> <p class="kicker" data-astro-cid-46mpiyzq>Comunitatea noastră</p> <h1 class="section-title" data-astro-cid-46mpiyzq>Feed social activ</h1> <p class="section-copy" data-astro-cid-46mpiyzq>
Scroll ca pe Facebook: fiecare postare are videoclip, text, like, comentarii și distribuire în social media.
</p> </header> <div class="community-feed-intro mt-6 rounded-3xl border border-white/20 bg-white/10 p-5 sm:p-6" data-astro-cid-46mpiyzq> <p class="text-sm font-semibold uppercase tracking-wider text-cyan-100" data-astro-cid-46mpiyzq>Obiectiv comunitate</p> <p class="mt-2 text-sm leading-relaxed text-white/80" data-astro-cid-46mpiyzq>
Fiecare share contează. Distribuie postările, lasă comentarii și ajută-ne să creștem comunitatea pentru sezonul 2026-2027.
</p> <p class="mt-3 text-xs font-semibold uppercase tracking-wider text-lime-100" data-astro-cid-46mpiyzq>
Administrare rapidă: editezi postările în fișierul src/data/communityPosts.json (model în src/data/communityPosts.template.json).
</p> </div> </section> <section class="section-container pb-16 sm:pb-20" data-astro-cid-46mpiyzq> <section class="community-gallery-wrap mx-auto mb-6 max-w-5xl rounded-2xl border border-white/20 bg-[#120a27d6] p-4 sm:p-5" data-astro-cid-46mpiyzq> <div class="flex items-center justify-between gap-3" data-astro-cid-46mpiyzq> <h2 class="text-lg font-extrabold text-white" data-astro-cid-46mpiyzq>Galerie Foto Comunitate</h2> <span class="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90" data-astro-cid-46mpiyzq> ${galleryPhotos.length} imagini
</span> </div> ${galleryPhotos.length > 0 ? renderTemplate`<div class="community-gallery-grid mt-4" data-db-gallery-grid data-astro-cid-46mpiyzq> ${galleryPhotos.map((photo) => renderTemplate`<article class="community-gallery-item"${addAttribute(photo.titlu, "aria-label")} data-astro-cid-46mpiyzq> <img${addAttribute(photo.imagine_url, "src")}${addAttribute(photo.titlu, "alt")} loading="lazy" data-astro-cid-46mpiyzq> <div class="community-gallery-meta" data-astro-cid-46mpiyzq> <p class="community-gallery-title" data-astro-cid-46mpiyzq>${photo.titlu}</p> <p class="community-gallery-date" data-astro-cid-46mpiyzq>${new Date(photo.data_upload).toLocaleDateString("ro-RO")}</p> </div> </article>`)} </div>` : renderTemplate`<p class="mt-3 text-sm text-white/90" data-astro-cid-46mpiyzq>Nu există poze în galerie momentan. Încarcă prima imagine din zona de administrator.</p>`} </section> <section class="admin-upload-panel mx-auto mb-4 max-w-3xl rounded-2xl border border-white/20 bg-[#140a2fe3] p-4 backdrop-blur" data-astro-cid-46mpiyzq> <p class="text-sm font-extrabold uppercase tracking-wider text-lime-100" data-astro-cid-46mpiyzq>Administrator: încărcare foto postare</p> <p class="mt-1 text-xs text-white/90" data-astro-cid-46mpiyzq>Drag & drop o imagine sau selectează fișierul. Imaginea este optimizată automat (max 1200px, WebP).</p> <form class="mt-3 grid gap-3" data-admin-upload-form data-astro-cid-46mpiyzq> <input id="admin-photo-input" type="file" name="photo" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="hidden" data-astro-cid-46mpiyzq> <label class="grid gap-1 text-xs font-semibold uppercase tracking-wider text-white/90" data-astro-cid-46mpiyzq>
Titlu fotografie
<input data-upload-title class="input-glass" type="text" maxlength="180" placeholder="Ex: Public în delir la final de seară" required data-astro-cid-46mpiyzq> </label> <div class="community-dropzone" data-dropzone role="button" tabindex="0" aria-label="Dropzone încărcare foto" data-astro-cid-46mpiyzq> <p class="text-sm font-bold text-white" data-astro-cid-46mpiyzq>Trage fotografia aici</p> <p class="mt-1 text-xs text-white/90" data-astro-cid-46mpiyzq>sau apasă pentru selectare (JPG, PNG, WebP, max 5MB)</p> </div> <img data-upload-preview class="community-upload-preview hidden" alt="Previzualizare fotografie" data-astro-cid-46mpiyzq> <div class="flex flex-wrap gap-2" data-astro-cid-46mpiyzq> <button type="button" class="btn-outline" data-dropzone-trigger data-astro-cid-46mpiyzq>Selectează fișier</button> <button type="submit" class="btn-solid" data-upload-submit data-astro-cid-46mpiyzq>Optimizează și încarcă</button> </div> <p class="hidden rounded-lg border px-3 py-2 text-xs font-semibold" data-upload-status role="status" aria-live="polite" data-astro-cid-46mpiyzq></p> <label class="grid gap-1 text-xs font-semibold uppercase tracking-wider text-white/90" data-astro-cid-46mpiyzq>
URL imagine încărcată
<input data-upload-url class="input-glass" type="text" readonly placeholder="Va apărea aici după upload" data-astro-cid-46mpiyzq> </label> </form> </section> <div class="community-toolbar sticky top-24 z-20 mx-auto mb-4 grid max-w-3xl gap-3 rounded-2xl border border-white/20 bg-[#0a1433de] p-3 backdrop-blur sm:grid-cols-[1fr_auto] sm:items-center" data-astro-cid-46mpiyzq> <div class="flex items-center gap-3" data-astro-cid-46mpiyzq> <div class="community-avatar" aria-hidden="true" data-astro-cid-46mpiyzq>FP</div> <label class="w-full" for="new-community-post" data-astro-cid-46mpiyzq> <span class="sr-only" data-astro-cid-46mpiyzq>Creare postare</span> <input id="new-community-post" type="text" class="input-glass w-full" placeholder="Ce vrei să postezi astăzi în comunitate?" readonly data-astro-cid-46mpiyzq> </label> </div> <div class="flex flex-wrap gap-2" data-astro-cid-46mpiyzq> <button type="button" class="btn-outline" data-create-post-demo data-astro-cid-46mpiyzq>Publică postare</button> <select class="input-glass min-w-48" data-feed-sort aria-label="Sortează feed-ul comunității" data-astro-cid-46mpiyzq> <option value="newest" selected data-astro-cid-46mpiyzq>Cele mai noi</option> <option value="top" data-astro-cid-46mpiyzq>Cele mai apreciate</option> </select> <div class="community-filter-wrap flex flex-wrap gap-2" role="group" aria-label="Filtrează postările comunității" data-astro-cid-46mpiyzq> <button type="button" class="community-filter-btn is-active" data-feed-filter="all" aria-pressed="true" data-astro-cid-46mpiyzq>Toate</button> <button type="button" class="community-filter-btn" data-feed-filter="gallery" aria-pressed="false" data-astro-cid-46mpiyzq>Galerie Video</button> <button type="button" class="community-filter-btn" data-feed-filter="tv" aria-pressed="false" data-astro-cid-46mpiyzq>Apariții TV</button> </div> </div> </div> <div class="community-feed mx-auto grid w-full max-w-none gap-4" data-astro-cid-46mpiyzq> ${feedPosts.map((item, index) => {
    const mediaUrl = item.youtubeUrl || item.imageUrl || "";
    return renderTemplate`<article class="community-post glass-card" data-social-card${addAttribute(item.id, "data-video-id")}${addAttribute(index + 1, "data-feed-order")}${addAttribute(getFeedType(item.source), "data-feed-type")} data-astro-cid-46mpiyzq> <header class="community-post-head flex items-center gap-3" data-astro-cid-46mpiyzq> <div class="community-avatar" aria-hidden="true" data-astro-cid-46mpiyzq>FP</div> <div data-astro-cid-46mpiyzq> <p class="text-sm font-extrabold text-white" data-astro-cid-46mpiyzq>${brand.name}</p> <p class="text-xs font-semibold text-white/85" data-astro-cid-46mpiyzq>${item.source} • ${item.publishedLabel}</p> </div> ${index === 0 && renderTemplate`<span class="community-pinned" data-astro-cid-46mpiyzq>Postare recomandată</span>`} </header> <h2 class="mt-3 text-base font-extrabold text-white" data-astro-cid-46mpiyzq>${item.title}</h2> <p class="mt-2 text-sm leading-relaxed text-white/80" data-astro-cid-46mpiyzq>${item.caption}</p> ${item.youtubeId ? renderTemplate`<iframe class="community-video mt-4 aspect-video w-full rounded-xl"${addAttribute(`https://www.youtube.com/embed/${item.youtubeId}`, "src")}${addAttribute(item.title, "title")} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen data-astro-cid-46mpiyzq></iframe>` : item.imageUrl ? renderTemplate`<img class="community-video community-photo mt-4 w-full rounded-xl"${addAttribute(item.imageUrl, "src")}${addAttribute(item.title, "alt")} loading="lazy" data-astro-cid-46mpiyzq>` : null} <div class="mt-4 flex items-center justify-between gap-3 border-b border-white/15 pb-3 text-xs font-semibold text-white/85" data-astro-cid-46mpiyzq> <p data-astro-cid-46mpiyzq><span data-like-count data-astro-cid-46mpiyzq>0</span> aprecieri</p> <p data-astro-cid-46mpiyzq><span data-comment-count data-astro-cid-46mpiyzq>0</span> comentarii</p> </div> <div class="community-post-actions mt-3 flex flex-wrap gap-2" data-astro-cid-46mpiyzq> <button type="button" class="community-action-btn" data-like-button data-astro-cid-46mpiyzq>Like</button> ${mediaUrl && renderTemplate`<a${addAttribute(mediaUrl, "href")} target="_blank" rel="noopener noreferrer" class="community-action-btn" data-astro-cid-46mpiyzq> ${item.youtubeId ? "Vezi pe YouTube" : "Vezi fotografia"} </a>`} <button type="button" class="community-action-btn"${addAttribute(mediaUrl, "data-share-facebook")} data-astro-cid-46mpiyzq>Distribuie Facebook</button> <button type="button" class="community-action-btn"${addAttribute(mediaUrl, "data-share-whatsapp")} data-astro-cid-46mpiyzq>Distribuie WhatsApp</button> <button type="button" class="community-action-btn"${addAttribute(mediaUrl, "data-copy-link")} data-astro-cid-46mpiyzq>Copiază link postare</button> </div> <a${addAttribute(buildWhatsAppCta(mediaUrl || "https://landing-ul-meu.example.com/comunitatea-noastra"), "href")} target="_blank" rel="noopener noreferrer" class="community-whatsapp-cta mt-3" data-astro-cid-46mpiyzq>
Cere ofertă pe WhatsApp pentru acest tip de moment
</a> <form class="mt-4 grid gap-2" data-comment-form data-astro-cid-46mpiyzq> <label class="sr-only"${addAttribute(`name-${item.id}`, "for")} data-astro-cid-46mpiyzq>Nume</label> <input${addAttribute(`name-${item.id}`, "id")} name="name" type="text" class="input-glass" maxlength="60" placeholder="Numele tău" required data-astro-cid-46mpiyzq> <label class="sr-only"${addAttribute(`comment-${item.id}`, "for")} data-astro-cid-46mpiyzq>Comentariu</label> <textarea${addAttribute(`comment-${item.id}`, "id")} name="comment" class="input-glass min-h-24 resize-y" minlength="3" maxlength="360" placeholder="Scrie un comentariu la această postare" required data-astro-cid-46mpiyzq></textarea> <button type="submit" class="btn-solid justify-center" data-astro-cid-46mpiyzq>Publică comentariul</button> </form> <div class="community-comments mt-4" data-comment-list aria-live="polite" data-astro-cid-46mpiyzq></div> </article>`;
  })} </div> </section>   ` })}`;
}, "D:/landing-ul meu/src/pages/comunitatea-noastra.astro", void 0);

const $$file = "D:/landing-ul meu/src/pages/comunitatea-noastra.astro";
const $$url = "/comunitatea-noastra";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$ComunitateaNoastra,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
