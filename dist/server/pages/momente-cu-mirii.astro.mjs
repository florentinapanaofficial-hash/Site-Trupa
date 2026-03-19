/* empty css                                       */
import { g as createComponent, j as renderComponent, r as renderTemplate, m as maybeRenderHead, i as addAttribute } from '../chunks/astro/server_CJG6WAvb.mjs';
import 'kleur/colors';
import { s as siteContent, $ as $$BaseLayout } from '../chunks/BaseLayout_Cb1f9pvv.mjs';
import { $ as $$BackButton } from '../chunks/BackButton_DStPoh2H.mjs';
import { q as query } from '../chunks/db_bBUj1s93.mjs';
/* empty css                                            */
export { renderers } from '../renderers.mjs';

const prerender = false;
const $$MomenteCuMirii = createComponent(async ($$result, $$props, $$slots) => {
  const { realMoments, brand } = siteContent;
  let dbMomentPhotos = [];
  try {
    const rows = await query(
      `SELECT id, titlu, imagine_url, data_upload
     FROM gallery
     WHERE imagine_url LIKE '/uploads/%'
     ORDER BY data_upload DESC, id DESC
     LIMIT 60`
    );
    dbMomentPhotos = rows.filter((row) => typeof row.imagine_url === "string" && row.imagine_url.startsWith("/uploads/"));
  } catch (error) {
    console.error("Nu s-au putut citi pozele pentru galeria completă:", error);
  }
  const hasDbMomentPhotos = dbMomentPhotos.length > 0;
  const deriveAudioUrlFromImage = (imageUrl) => {
    const cleanUrl = String(imageUrl || "").split("?")[0];
    const fileName = cleanUrl.split("/").pop() ?? "";
    const baseName = fileName.replace(/\.[^.]+$/, "");
    if (!baseName) return "";
    return `/uploads/audio/${baseName}.mp3`;
  };
  const albumSourcePhotos = hasDbMomentPhotos ? dbMomentPhotos.map((photo) => ({
    title: photo.titlu,
    image: photo.imagine_url,
    caption: `${photo.titlu} • ${new Date(photo.data_upload).toLocaleDateString("ro-RO")}`,
    audio: deriveAudioUrlFromImage(photo.imagine_url),
    quote: ""
  })) : realMoments.events.map((item) => ({
    title: item.couple,
    image: item.image,
    caption: `${item.couple} • ${item.city} • ${item.date}`,
    audio: item.audioUrl ?? "",
    quote: item.coupleQuote ?? ""
  }));
  const minimumPhotosForPreview = 12;
  const demoPhotos = Array.from({ length: minimumPhotosForPreview }, (_, index) => {
    const photoNumber = index + 1;
    return {
      title: `Demo Album ${photoNumber}`,
      image: `https://placehold.co/1600x900/${photoNumber % 2 === 0 ? "1d2e5f" : "293d78"}/f1f7ff?text=Demo+${photoNumber}`,
      caption: `Cadru demo ${photoNumber} • verificare paginare`,
      audio: "",
      quote: ""
    };
  });
  const paddedAlbumPhotos = albumSourcePhotos.length > 0 ? albumSourcePhotos : [...realMoments.events.map((item) => ({
    title: item.couple,
    image: item.image,
    caption: `${item.couple} • ${item.city} • ${item.date}`,
    audio: item.audioUrl ?? "",
    quote: item.coupleQuote ?? ""
  })), ...demoPhotos];
  paddedAlbumPhotos.slice(0, 60);
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": `Momente cu mirii | ${brand.name}`, "description": "Galerie completă cu poze ale mirilor și trupei. Caută după eveniment, cuplu sau locație." }, { "default": async ($$result2) => renderTemplate`  ${maybeRenderHead()}<section class="section-container pt-6 pb-16" id="momente-reale"> <div class="mb-4">${renderComponent($$result2, "BackButton", $$BackButton, { "href": "/", "label": "Acasă" })}</div> <header class="section-head mx-auto text-center"> <p class="kicker mx-auto">Galerie specială</p> <h1 class="section-title">Momente cu Mirii | Formația Florentina Pană</h1> <p class="section-copy">Album în format landscape, cu pagini stânga-dreapta ca o foaie A4 pe orizontală, ideal pentru cadre largi cu mirii și trupa.</p> </header> <div class="mt-5 flex flex-wrap justify-center gap-2"> <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100"> ${hasDbMomentPhotos ? `${dbMomentPhotos.length}+` : realMoments.stats.events} cadre
</span> </div> <!-- ─── Couple Cards ────────────────────────────────────────────── --> <div class="couple-cards-section"> <header class="couple-cards-section-head"> <p class="kicker mx-auto">Poveștile lor</p> <h2 class="section-title text-2xl md:text-3xl">Momentele care ne-au umplut inima</h2> </header> <div class="couple-cards-grid"> ${realMoments.events.map((event) => {
    return renderTemplate`<article class="couple-card"${addAttribute(`${event.couple} ${event.city} ${event.date}`.toLowerCase(), "data-couple-search")}${addAttribute(`--cc:${event.accentColor ?? "#f5a623"};--cc-glow:${event.accentGlow ?? "rgba(245,166,35,0.28)"}`, "style")}>  <button type="button" class="cc-photo"${addAttribute(event.image, "data-lightbox-src")}${addAttribute(event.couple, "data-lightbox-alt")}${addAttribute(`${event.couple} • ${event.city} • ${event.date}`, "data-lightbox-caption")}${addAttribute(event.audioUrl ?? "", "data-lightbox-audio")}${addAttribute(event.coupleQuote ?? "", "data-lightbox-quote")}${addAttribute(`Deschide fotografia ${event.couple}`, "aria-label")}> <img${addAttribute(event.image, "src")}${addAttribute(event.couple, "alt")} loading="eager" decoding="async"> <div class="cc-name-overlay"> <span class="cc-name">${event.couple}</span> <span class="cc-meta">${event.city} &bull; ${event.date}</span> </div> </button>  <div class="cc-footer"> ${event.coupleQuote && renderTemplate`<p class="cc-quote">${event.coupleQuote}</p>`} <div class="cc-links"> ${event.blogSlug && renderTemplate`<a class="cc-link"${addAttribute(`/blog/${event.blogSlug}`, "href")}>
Citește povestea lor &rarr;
</a>`} <a class="cc-link cc-link--dance" href="/galerie-video#dans-miri">
Dansul Mirilor &rarr;
</a> </div> </div> </article>`;
  })} </div> </div> <!-- ─────────────────────────────────────────────────────────────── --> <dialog id="photo-lightbox" class="photo-lightbox cinematic-lightbox"> <!-- Cer la apus — înăuntrul dialogului, vizibil în top-layer --> <div id="sunset-overlay" aria-hidden="true"></div> <canvas id="lightbox-fireworks" class="lightbox-fireworks-canvas" aria-hidden="true"></canvas> <button type="button" class="lightbox-close-btn" data-lightbox-close aria-label="Închide galeria">✕</button> <div class="lightbox-stage"> <button type="button" class="lightbox-nav-btn lightbox-nav-prev" data-lightbox-prev aria-label="Fotografia anterioară" disabled>&#8249;</button> <div class="lightbox-image-shell"> <img id="photo-lightbox-image" src="" alt="" class="lightbox-image"> </div> <button type="button" class="lightbox-nav-btn lightbox-nav-next" data-lightbox-next aria-label="Fotografia următoare" disabled>&#8250;</button> </div> <p id="photo-lightbox-caption" class="lightbox-caption"></p> <div class="lightbox-size-selector" aria-label="Alege dimensiunea imaginii"> <button type="button" class="lightbox-size-btn" data-lightbox-size-toggle>Preset: Normal</button> </div> <div class="lightbox-demo-sound-wrap"> <button type="button" class="lightbox-demo-sound-btn" data-lightbox-demo-sound>Redă sunet demo</button> </div> <div class="lightbox-audio-wrap"> <p id="photo-lightbox-audio-note" class="lightbox-audio-note hidden">Testimonial audio personalizat pentru această fotografie.</p> <button type="button" class="audio-play-btn" data-lightbox-audio-play aria-label="Redă testimonial audio"> <span class="audio-icon" aria-hidden="true"> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M3 9V15H7L12 20V4L7 9H3Z" fill="#eaf4ff"></path> <path d="M16.5 12C16.5 13.1046 15.6046 14 14.5 14V10C15.6046 10 16.5 10.8954 16.5 12Z" fill="#eaf4ff"></path> <path d="M19 12C19 15.3137 16.3137 18 13 18V16C15.2091 16 17 14.2091 17 12C17 9.79086 15.2091 8 13 8V6C16.3137 6 19 8.68629 19 12Z" fill="#eaf4ff"></path> </svg> </span> </button> <audio id="photo-lightbox-audio" class="lightbox-audio hidden" controls preload="none"></audio> </div> <blockquote id="photo-lightbox-quote" class="lightbox-quote hidden" role="presentation"> <p class="lightbox-quote-text"></p> </blockquote> <div class="lightbox-blessing" role="contentinfo"> <p class="lightbox-blessing-main">Formația Florentina Pană urează <strong>Casă de Piatră</strong> tinerilor căsătoriți! 💍</p> <div class="lightbox-blessing-admin" data-lightbox-blessing-extra> <!-- Administrator: adaugă mesajul personalizat aici --> </div> </div> </dialog> </section>   ` })}`;
}, "D:/landing-ul meu/src/pages/momente-cu-mirii.astro", void 0);
const $$file = "D:/landing-ul meu/src/pages/momente-cu-mirii.astro";
const $$url = "/momente-cu-mirii";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$MomenteCuMirii,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
