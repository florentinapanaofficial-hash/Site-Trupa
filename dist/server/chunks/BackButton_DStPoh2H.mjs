import { f as createAstro, g as createComponent, m as maybeRenderHead, i as addAttribute, r as renderTemplate } from './astro/server_CJG6WAvb.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                               */

const $$Astro = createAstro("https://florentinapanaofficial.ro");
const $$BackButton = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BackButton;
  const { href = "/", label = "\xCEnapoi" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<a${addAttribute(href, "href")} class="back-btn"${addAttribute(`\xCEnapoi \u2014 ${label}`, "aria-label")} onclick="history.length > 1 ? (history.back(), event.preventDefault()) : null" data-astro-cid-7a7bzblm> <svg class="back-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-astro-cid-7a7bzblm> <path d="M19 12H5M12 5l-7 7 7 7" data-astro-cid-7a7bzblm></path> </svg> </a>  <!-- gradient SVG defs injectate o singură dată în DOM --> <svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true" data-astro-cid-7a7bzblm> <defs data-astro-cid-7a7bzblm> <linearGradient id="pearl-grad" x1="0%" y1="0%" x2="100%" y2="100%" data-astro-cid-7a7bzblm> <stop offset="0%" stop-color="#b8e8ff" data-astro-cid-7a7bzblm></stop> <stop offset="45%" stop-color="#7ecfff" data-astro-cid-7a7bzblm></stop> <stop offset="100%" stop-color="#c2f0ff" data-astro-cid-7a7bzblm></stop> </linearGradient> </defs> </svg>`;
}, "D:/landing-ul meu/src/components/BackButton.astro", void 0);

export { $$BackButton as $ };
