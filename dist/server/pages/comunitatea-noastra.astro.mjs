/* empty css                                       */
import { g as createComponent, j as renderComponent, r as renderTemplate, m as maybeRenderHead, i as addAttribute } from '../chunks/astro/server_CJG6WAvb.mjs';
import 'kleur/colors';
import { s as siteContent, $ as $$BaseLayout } from '../chunks/BaseLayout_Cb1f9pvv.mjs';
import { $ as $$BackButton } from '../chunks/BackButton_DStPoh2H.mjs';
import { b as blogPosts } from '../chunks/blogPosts_Cm5hw4xl.mjs';
import { q as query } from '../chunks/db_bBUj1s93.mjs';
/* empty css                                               */
export { renderers } from '../renderers.mjs';

const items = [
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
const communityPosts = {
	items: items
};

const prerender = false;
const $$ComunitateaNoastra = createComponent(async ($$result, $$props, $$slots) => {
  const { brand, seo, videos, tvAppearances, contact, realMoments } = siteContent;
  const getYoutubeId = (url) => {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return match?.[1] ?? "";
  };
  const whatsappNumber = contact.phoneRaw.replace(/\D/g, "");
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
  const adminFeedPosts = (communityPosts.items ?? []).map((item, index) => {
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
  adminFeedPosts.length > 0 ? adminFeedPosts : fallbackFeedPosts;
  const formatDate = (d) => new Date(d).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
  const accentBgMap = {
    rose: "rgba(232,50,90,0.22)",
    gold: "rgba(245,166,35,0.22)",
    teal: "rgba(11,188,214,0.2)"
  };
  const accentColorMap = {
    rose: "var(--rose)",
    gold: "var(--gold)",
    teal: "var(--teal)"
  };
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
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": pageTitle, "description": pageDescription, "ogImage": seo.ogImage, "data-astro-cid-46mpiyzq": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="section-container pt-8 pb-6 sm:pt-10" data-astro-cid-46mpiyzq> <div class="mb-6" data-astro-cid-46mpiyzq>${renderComponent($$result2, "BackButton", $$BackButton, { "href": "/", "label": "Acas\u0103", "data-astro-cid-46mpiyzq": true })}</div> <header class="section-head mx-auto text-center" data-astro-cid-46mpiyzq> <p class="kicker" data-astro-cid-46mpiyzq>Formația Florentina Pană</p> <h1 class="section-title" data-astro-cid-46mpiyzq>Recenzii și Testimoniale | Formația Florentina Pană</h1> <p class="section-copy" data-astro-cid-46mpiyzq>
Fiecare nuntă e o poveste unică. Iată ce spun cuplurile care ne-au încredințat cele mai frumoase momente din viața lor.
</p> </header> </section> <section class="section-container pb-16 sm:pb-20" data-astro-cid-46mpiyzq> <!-- ─── Testimoniale ─────────────────────────────────────────────── --> <div class="testimonials-wrap mx-auto mb-14 max-w-5xl" data-astro-cid-46mpiyzq> <div class="testimonials-head mb-8 text-center" data-astro-cid-46mpiyzq> <p class="kicker mx-auto" data-astro-cid-46mpiyzq>Ce spun ei</p> <h2 class="section-title text-2xl md:text-3xl" data-astro-cid-46mpiyzq>Cuvintele lor valorează mai mult decât orice reclamă</h2> </div> <div class="testimonials-grid" data-astro-cid-46mpiyzq> ${realMoments.events.map((event) => {
    const accentColor = event.accentColor ?? "#f5a623";
    const blogSlug = event.blogSlug ?? "";
    const initials = event.couple.split("&").map((n) => n.trim()[0] ?? "").join("");
    return renderTemplate`<article class="testimonial-card"${addAttribute(`--tc:${accentColor}`, "style")} data-astro-cid-46mpiyzq> <div class="tc-stars" aria-label="5 stele din 5" data-astro-cid-46mpiyzq>★★★★★</div> <blockquote class="tc-quote" data-astro-cid-46mpiyzq>${event.coupleQuote}</blockquote> <footer class="tc-footer" data-astro-cid-46mpiyzq> <div class="tc-avatar" aria-hidden="true" data-astro-cid-46mpiyzq>${initials}</div> <div class="tc-meta" data-astro-cid-46mpiyzq> <p class="tc-name" data-astro-cid-46mpiyzq>${event.couple}</p> <p class="tc-location" data-astro-cid-46mpiyzq>${event.city} &bull; ${event.date}</p> </div> ${blogSlug && renderTemplate`<a class="tc-blog-link"${addAttribute(`/blog/${blogSlug}`, "href")} data-astro-cid-46mpiyzq>Povestea lor →</a>`} </footer> </article>`;
  })} </div> </div> <!-- ─────────────────────────────────────────────────────────────── --> <section class="community-gallery-wrap mx-auto mb-6 max-w-5xl rounded-2xl border border-white/20 bg-[#120a27d6] p-4 sm:p-5" data-astro-cid-46mpiyzq> <div class="flex items-center justify-between gap-3" data-astro-cid-46mpiyzq> <h2 class="text-lg font-extrabold text-white" data-astro-cid-46mpiyzq>Galerie Foto Comunitate</h2> <span class="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90" data-astro-cid-46mpiyzq> ${galleryPhotos.length} imagini
</span> </div> ${galleryPhotos.length > 0 ? renderTemplate`<div class="community-gallery-grid mt-4" data-db-gallery-grid data-astro-cid-46mpiyzq> ${galleryPhotos.map((photo) => renderTemplate`<article class="community-gallery-item"${addAttribute(photo.titlu, "aria-label")} data-astro-cid-46mpiyzq> <img${addAttribute(photo.imagine_url, "src")}${addAttribute(photo.titlu, "alt")} loading="lazy" data-astro-cid-46mpiyzq> <div class="community-gallery-meta" data-astro-cid-46mpiyzq> <p class="community-gallery-title" data-astro-cid-46mpiyzq>${photo.titlu}</p> <p class="community-gallery-date" data-astro-cid-46mpiyzq>${new Date(photo.data_upload).toLocaleDateString("ro-RO")}</p> </div> </article>`)} </div>` : renderTemplate`<p class="mt-3 text-sm text-white/90" data-astro-cid-46mpiyzq>Nu există poze în galerie momentan.</p>`} </section> <div class="mx-auto max-w-5xl" data-astro-cid-46mpiyzq> <aside id="blog" class="community-editorial-column min-w-0" aria-label="Publicații și Vlog" data-astro-cid-46mpiyzq> <div class="blog-aside-header" data-astro-cid-46mpiyzq> <p class="blog-aside-kicker" data-astro-cid-46mpiyzq>Publicații &amp; Vlog</p> <h2 class="blog-aside-title" data-astro-cid-46mpiyzq>Articole &amp; povești</h2> <p class="blog-aside-sub" data-astro-cid-46mpiyzq>Muzică, culise și ghiduri utile pentru evenimentul tău — scrise de noi, pentru tine.</p> </div> <div class="blog-list" data-astro-cid-46mpiyzq> ${blogPosts.items.map((post) => {
    const bg = accentBgMap[post.categoryAccent] ?? "rgba(245,166,35,0.22)";
    const color = accentColorMap[post.categoryAccent] ?? "var(--gold)";
    return renderTemplate`<a${addAttribute(`/blog/${post.slug}`, "href")} class="blog-card" data-astro-cid-46mpiyzq> <div class="blog-card-thumb" aria-hidden="true"${addAttribute(`background: radial-gradient(ellipse at 50% 50%, ${bg} 0%, var(--bg-mid) 100%);`, "style")} data-astro-cid-46mpiyzq> <span data-astro-cid-46mpiyzq>${post.coverEmoji}</span> </div> <div class="blog-card-text" data-astro-cid-46mpiyzq> <div class="blog-card-top" data-astro-cid-46mpiyzq> <span class="blog-cat-pill"${addAttribute(`color:${color}; border-color:${color}; background:${bg};`, "style")} data-astro-cid-46mpiyzq> ${post.category} </span> <span class="blog-card-time" data-astro-cid-46mpiyzq>${post.readTime}</span> </div> <p class="blog-card-title" data-astro-cid-46mpiyzq>${post.title}</p> <p class="blog-card-excerpt" data-astro-cid-46mpiyzq>${post.excerpt}</p> <span class="blog-card-date" data-astro-cid-46mpiyzq>${formatDate(post.date)}</span> </div> </a>`;
  })} </div> <a${addAttribute(`/blog/${blogPosts.items[0]?.slug ?? ""}`, "href")} class="blog-aside-cta" data-astro-cid-46mpiyzq>
Citește ultimul articol
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" data-astro-cid-46mpiyzq><path d="m9 18 6-6-6-6" data-astro-cid-46mpiyzq></path></svg> </a> </aside> </div> <!-- ─── CTA rezervare ────────────────────────────────────────────── --> <div class="ctab-wrap mx-auto mt-14 max-w-3xl" data-astro-cid-46mpiyzq> <p class="ctab-kicker" data-astro-cid-46mpiyzq>Sezonul 2026–2027</p> <h2 class="ctab-title" data-astro-cid-46mpiyzq>Vrei să faci parte din familia noastră?</h2> <p class="ctab-sub" data-astro-cid-46mpiyzq>Locurile se ocupă rapid. Contactează-ne acum și asigură-ți data dorită.</p> <div class="ctab-actions" data-astro-cid-46mpiyzq> <a${addAttribute(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Bun\u0103! Vreau s\u0103 rezerv o dat\u0103 pentru evenimentul meu cu Forma\u021Bia Florentina Pan\u0103.")}`, "href")} class="ctab-btn ctab-btn--wa" target="_blank" rel="noopener noreferrer" data-astro-cid-46mpiyzq> <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-astro-cid-46mpiyzq><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" data-astro-cid-46mpiyzq></path></svg>
Scrie pe WhatsApp
</a> <a href="/contact" class="ctab-btn ctab-btn--outline" data-astro-cid-46mpiyzq>Formular contact →</a> </div> </div> <!-- ─────────────────────────────────────────────────────────────── --> </section>   ` })}`;
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
