/* empty css                                       */
import { g as createComponent, j as renderComponent, r as renderTemplate, m as maybeRenderHead, i as addAttribute } from '../chunks/astro/server_hiwJrkZg.mjs';
import 'kleur/colors';
import { s as siteContent, $ as $$BaseLayout } from '../chunks/BaseLayout_CtZKKNqC.mjs';
import { q as query } from '../chunks/db_bBUj1s93.mjs';
/* empty css                                            */
export { renderers } from '../renderers.mjs';

const prerender = false;
const $$MomenteCuMirii = createComponent(async ($$result, $$props, $$slots) => {
  const { seo, realMoments } = siteContent;
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
  const albumPhotos = paddedAlbumPhotos.slice(0, 60);
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": `Povestea noastră rămâne în ecouri și imagini | ${seo.title}`, "description": "Galerie completă cu poze ale mirilor și trupei, cu upload drag-and-drop și redimensionare automată.", "data-astro-cid-kjpldenz": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="section-container py-16" id="momente-reale" data-astro-cid-kjpldenz> <header class="section-head mx-auto text-center" data-astro-cid-kjpldenz> <p class="kicker mx-auto" data-astro-cid-kjpldenz>Galerie specială</p> <h1 class="section-title" data-astro-cid-kjpldenz>Povestea noastră rămâne în ecouri și imagini</h1> <p class="section-copy" data-astro-cid-kjpldenz>Album în format landscape, cu pagini stânga-dreapta ca o foaie A4 pe orizontală, ideal pentru cadre largi cu mirii și trupa.</p> </header> <div class="mt-5 flex flex-wrap justify-center gap-2" data-astro-cid-kjpldenz> <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100" data-astro-cid-kjpldenz> ${hasDbMomentPhotos ? `${dbMomentPhotos.length}+` : realMoments.stats.events} cadre
</span> <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-lime-100" data-astro-cid-kjpldenz>
Upload drag and drop
</span> </div> <section class="mx-auto mt-6 max-w-3xl rounded-2xl border border-white/20 bg-[#120722de] p-4 backdrop-blur" data-astro-cid-kjpldenz> <div class="flex flex-wrap items-end gap-3" data-astro-cid-kjpldenz> <label class="form-label m-0 flex-1 min-w-[220px]" data-astro-cid-kjpldenz>
Caută în galerie
<input class="input-glass" type="search" data-album-search-input placeholder="Ex: Pitești, nuntă, Andreea și Florin" maxlength="120" data-astro-cid-kjpldenz> </label> <button type="button" class="btn-solid" data-album-search-button data-astro-cid-kjpldenz>Caută</button> <button type="button" class="btn-outline" data-album-search-clear data-astro-cid-kjpldenz>Resetează</button> </div> <p class="mt-2 text-xs font-semibold text-white/80" data-album-search-result data-astro-cid-kjpldenz>Se afișează toate fotografiile.</p> </section> <section class="mx-auto mt-6 max-w-3xl rounded-2xl border border-white/20 bg-[#140a2fe3] p-4 backdrop-blur" data-astro-cid-kjpldenz> <div class="flex flex-wrap items-center justify-between gap-2" data-astro-cid-kjpldenz> <h2 class="text-sm font-extrabold uppercase tracking-[0.08em] text-white" data-astro-cid-kjpldenz>Upload poze miri + trupă</h2> <span class="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/90" data-astro-cid-kjpldenz>
Redimensionare automată
</span> </div> <form class="mt-3 grid gap-3" data-home-gallery-upload-form data-astro-cid-kjpldenz> <label class="form-label" data-astro-cid-kjpldenz>
Titlu fotografie
<input class="input-glass" type="text" name="title" data-home-gallery-title placeholder="Ex: Mirii + formația - Pitești" minlength="2" maxlength="180" required data-astro-cid-kjpldenz> </label> <input id="home-gallery-photo-input" name="photo" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-astro-cid-kjpldenz> <input id="home-gallery-audio-input" name="audio" type="file" accept="audio/mpeg,.mp3" class="hidden" data-astro-cid-kjpldenz> <div class="rounded-xl border-2 border-dashed border-fuchsia-300/70 bg-fuchsia-500/10 p-4 text-center transition-all duration-200" data-home-gallery-dropzone role="button" tabindex="0" aria-label="Dropzone încărcare foto" data-astro-cid-kjpldenz> <p class="text-sm font-semibold text-white" data-astro-cid-kjpldenz>Trage poza aici sau apasă pentru selecție</p> <p class="mt-1 text-xs text-white/90" data-astro-cid-kjpldenz>Formate acceptate: JPG, PNG, WebP, max 5MB</p> <img data-home-gallery-preview class="mx-auto mt-3 hidden max-h-40 rounded-xl border border-white/20" alt="Preview fotografie" data-astro-cid-kjpldenz> </div> <div class="rounded-xl border-2 border-dashed border-cyan-300/70 bg-cyan-500/10 p-4 text-center transition-all duration-200" data-home-audio-dropzone role="button" tabindex="0" aria-label="Dropzone încărcare audio MP3" data-astro-cid-kjpldenz> <p class="text-sm font-semibold text-white" data-astro-cid-kjpldenz>Trage MP3-ul testimonial aici sau apasă pentru selecție</p> <p class="mt-1 text-xs text-white/90" data-astro-cid-kjpldenz>Opțional, dar recomandat pentru personalizare foto. Format: MP3, max 4MB</p> <p class="mt-2 text-xs font-semibold text-cyan-100" data-home-audio-file-name data-astro-cid-kjpldenz>Nu ai selectat audio.</p> </div> <div class="flex flex-wrap items-center gap-3" data-astro-cid-kjpldenz> <button type="button" class="btn-outline" data-home-gallery-dropzone-trigger data-astro-cid-kjpldenz>Selectează fișier</button> <button type="button" class="btn-outline" data-home-audio-dropzone-trigger data-astro-cid-kjpldenz>Selectează MP3</button> <button type="submit" class="btn-solid" data-home-gallery-submit data-astro-cid-kjpldenz>Optimizează și încarcă</button> </div> <input class="input-glass" type="text" readonly placeholder="URL imagine încărcată" data-home-gallery-url data-astro-cid-kjpldenz> <p class="hidden rounded-xl border px-3 py-2 text-xs" data-home-gallery-status aria-live="polite" data-astro-cid-kjpldenz></p> </form> </section> <div class="cinematic-album-wrap mt-10" data-home-gallery-grid${addAttribute(hasDbMomentPhotos ? "db" : "fallback", "data-home-gallery-source")}${addAttribute(JSON.stringify(albumPhotos), "data-album-photos")} data-astro-cid-kjpldenz> <div class="cinematic-album" role="region" aria-label="Album virtual cinematic" data-astro-cid-kjpldenz> <div class="album-spine" aria-hidden="true" data-astro-cid-kjpldenz></div> <div class="album-flip-sheet" aria-hidden="true" data-astro-cid-kjpldenz></div> <article class="album-page album-page-left" data-album-page-left data-astro-cid-kjpldenz></article> <article class="album-page album-page-right" data-album-page-right data-astro-cid-kjpldenz></article> </div> <div class="album-controls" aria-label="Navigare album" data-astro-cid-kjpldenz> <button type="button" class="album-nav-btn" data-album-prev aria-label="Pagina anterioară" data-astro-cid-kjpldenz>Pagina anterioară</button> <p class="album-page-indicator" data-album-indicator data-astro-cid-kjpldenz>Pagina 1</p> <button type="button" class="album-nav-btn" data-album-next aria-label="Pagina următoare" data-astro-cid-kjpldenz>Pagina următoare</button> <button type="button" class="album-sound-btn" data-album-sound-toggle aria-pressed="true" aria-label="Comută sunetul de întoarcere pagină" data-astro-cid-kjpldenz>Sunet flip: ON</button> </div> </div> <p class="mt-5 text-xs font-semibold uppercase tracking-wider text-white/85" data-astro-cid-kjpldenz>${realMoments.consentNote}</p> <dialog id="photo-lightbox" class="photo-lightbox cinematic-lightbox" data-astro-cid-kjpldenz> <canvas id="lightbox-fireworks" class="lightbox-fireworks-canvas" aria-hidden="true" data-astro-cid-kjpldenz></canvas> <button type="button" class="lightbox-close-btn" data-lightbox-close aria-label="Închide galeria" data-astro-cid-kjpldenz>✕</button> <div class="lightbox-stage" data-astro-cid-kjpldenz> <button type="button" class="lightbox-nav-btn lightbox-nav-prev" data-lightbox-prev aria-label="Fotografia anterioară" disabled data-astro-cid-kjpldenz>&#8249;</button> <div class="lightbox-image-shell" data-astro-cid-kjpldenz> <div class="lightbox-image-frame" data-astro-cid-kjpldenz> <img id="photo-lightbox-image" src="" alt="" class="lightbox-image" data-astro-cid-kjpldenz> </div> </div> <button type="button" class="lightbox-nav-btn lightbox-nav-next" data-lightbox-next aria-label="Fotografia următoare" disabled data-astro-cid-kjpldenz>&#8250;</button> </div> <p id="photo-lightbox-caption" class="lightbox-caption" data-astro-cid-kjpldenz></p> <div class="lightbox-frame-selector" aria-label="Alege stilul ramei" data-astro-cid-kjpldenz> <button type="button" class="lightbox-frame-btn is-active" data-frame-theme-button="gold" data-astro-cid-kjpldenz>Auriu</button> <button type="button" class="lightbox-frame-btn" data-frame-theme-button="silver" data-astro-cid-kjpldenz>Argintiu</button> <button type="button" class="lightbox-frame-btn" data-frame-theme-button="wood" data-astro-cid-kjpldenz>Lemn</button> </div> <div class="lightbox-size-selector" aria-label="Alege dimensiunea imaginii" data-astro-cid-kjpldenz> <button type="button" class="lightbox-size-btn" data-lightbox-size-toggle data-astro-cid-kjpldenz>Preset: Normal</button> </div> <div class="lightbox-demo-sound-wrap" data-astro-cid-kjpldenz> <button type="button" class="lightbox-demo-sound-btn" data-lightbox-demo-sound data-astro-cid-kjpldenz>Redă sunet demo</button> </div> <div class="lightbox-audio-wrap" data-astro-cid-kjpldenz> <p id="photo-lightbox-audio-note" class="lightbox-audio-note hidden" data-astro-cid-kjpldenz>Testimonial audio personalizat pentru această fotografie.</p> <button type="button" class="audio-play-btn" data-lightbox-audio-play aria-label="Redă testimonial audio" data-astro-cid-kjpldenz> <span class="audio-icon" aria-hidden="true" data-astro-cid-kjpldenz> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-kjpldenz> <path d="M3 9V15H7L12 20V4L7 9H3Z" fill="#eaf4ff" data-astro-cid-kjpldenz></path> <path d="M16.5 12C16.5 13.1046 15.6046 14 14.5 14V10C15.6046 10 16.5 10.8954 16.5 12Z" fill="#eaf4ff" data-astro-cid-kjpldenz></path> <path d="M19 12C19 15.3137 16.3137 18 13 18V16C15.2091 16 17 14.2091 17 12C17 9.79086 15.2091 8 13 8V6C16.3137 6 19 8.68629 19 12Z" fill="#eaf4ff" data-astro-cid-kjpldenz></path> </svg> </span> </button> <audio id="photo-lightbox-audio" class="lightbox-audio hidden" controls preload="none" data-astro-cid-kjpldenz></audio> </div> <blockquote id="photo-lightbox-quote" class="lightbox-quote hidden" role="presentation" data-astro-cid-kjpldenz> <p class="lightbox-quote-text" data-astro-cid-kjpldenz></p> </blockquote> <div class="lightbox-blessing" role="contentinfo" data-astro-cid-kjpldenz> <p class="lightbox-blessing-main" data-astro-cid-kjpldenz>Formația Florentina Pană urează <strong data-astro-cid-kjpldenz>Casă de Piatră</strong> tinerilor căsătoriți! 💍</p> <div class="lightbox-blessing-admin" data-lightbox-blessing-extra data-astro-cid-kjpldenz> <!-- Administrator: adaugă mesajul personalizat aici --> </div> </div> </dialog> </section>   ` })}`;
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
