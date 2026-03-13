import { f as createAstro, g as createComponent, m as maybeRenderHead, i as addAttribute, r as renderTemplate, j as renderComponent, k as renderSlot, l as renderHead } from './astro/server_hiwJrkZg.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                               */

const brand = {
	name: "Formația Florentina Pană"};
const seo = {
	title: "Formația Florentina Pană | Muzică live pentru nunți și evenimente",
	description: "Formația Florentina Pană aduce show live pentru nunți, botezuri și evenimente corporate. Repertoriu variat, artiști profesioniști și energie pe scenă.",
	ogImage: "/images/og-placeholder.png"
};
const contact = {
	phoneRaw: "+40767369658",
	phoneDisplay: "0767 369 658",
	email: "florentinapanaofficial@gmail.com",
	city: "Argeș/Pitești, disponibilitate națională"
};
const socialLinks = {
	youtube: "https://www.youtube.com/@FlorentinaPanaPitesti",
	facebook: "https://www.facebook.com/florentinapanaofficial/?locale=ro_RO",
	instagram: "https://www.instagram.com/florentinaformatie/"
};
const navigation = [
	{
		href: "#acasa",
		label: "Acasă"
	},
	{
		href: "/comunitatea-noastra",
		label: "Noutăți"
	},
	{
		href: "#servicii",
		label: "Servicii"
	},
	{
		href: "#membri",
		label: "Membri"
	},
	{
		href: "#faq",
		label: "FAQ"
	},
	{
		href: "#contact",
		label: "Contact"
	}
];
const videos = [
	{
		title: "Muzică populară - moment live",
		youtubeId: "aDB9Aa9cFLY",
		youtubeUrl: "https://www.youtube.com/watch?v=aDB9Aa9cFLY",
		category: "petrecere"
	},
	{
		title: "Muzică populară - energie de petrecere",
		youtubeId: "LSd5N1AmiFg",
		youtubeUrl: "https://www.youtube.com/watch?v=LSd5N1AmiFg",
		category: "petrecere"
	},
	{
		title: "Muzică populară - recital live",
		youtubeId: "OSrEJczdKuw",
		youtubeUrl: "https://www.youtube.com/watch?v=OSrEJczdKuw",
		category: "petrecere"
	},
	{
		title: "Muzică ușoară - moment live",
		youtubeId: "xdcdjAtxZlA",
		youtubeUrl: "https://www.youtube.com/watch?v=xdcdjAtxZlA",
		category: "usoara-diverse"
	},
	{
		title: "Muzică ușoară - atmosferă live",
		youtubeId: "FyrQQqFMZvg",
		youtubeUrl: "https://www.youtube.com/watch?v=FyrQQqFMZvg",
		category: "usoara-diverse"
	}
];
const realMoments = {
	stats: {
		events: "150+"},
	consentNote: "Foto-video publicate cu acordul beneficiarilor.",
	events: [
		{
			title: "Eveniment Andreea & Radu",
			couple: "Andreea & Radu",
			city: "Pitești",
			date: "Septembrie 2025",
			image: "https://placehold.co/1600x900/1a234a/eef6ff?text=Andreea+%26+Radu",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
			coupleQuote: "\"A fost exact cum ne-am dorit: tradiție, eleganță și o atmosferă incredibilă pe ringul de dans.\""
		},
		{
			title: "Eveniment Bianca & Mihai",
			couple: "Bianca & Mihai",
			city: "Curtea de Argeș",
			date: "Iulie 2025",
			image: "https://placehold.co/1600x900/202b5a/eef6ff?text=Bianca+%26+Mihai",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
			coupleQuote: "\"Invitații au dansat toată noaptea. Formația a avut energie, profesionalism și comunicare perfectă.\""
		},
		{
			title: "Eveniment Ioana & Cătălin",
			couple: "Ioana & Cătălin",
			city: "București",
			date: "Iunie 2025",
			image: "https://placehold.co/1600x900/26336b/eef6ff?text=Ioana+%26+C%C4%83t%C4%83lin",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
			coupleQuote: "\"Ne-au ascultat toate dorințele muzicale și au creat o atmosferă premium de la început până la final.\""
		},
		{
			title: "Eveniment Alina & Ștefan",
			couple: "Alina & Ștefan",
			city: "Brașov",
			date: "Mai 2025",
			image: "https://placehold.co/1600x900/2b3878/eef6ff?text=Alina+%26+%C8%98tefan",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
			coupleQuote: "\"O echipă de nota 10! Au ridicat sala în picioare și au făcut din seara noastră o amintire de neuitat.\""
		}
	]
};
const tvAppearances = [
	{
		channel: "Televiziune Națională",
		show: "Emisiune de divertisment - Invitat special",
		year: "2025",
		note: "Moment live cu repertoriu popular și de petrecere.",
		videoUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
		logo: ""
	},
	{
		channel: "Post Regional",
		show: "Gala Muzicii Live",
		year: "2024",
		note: "Recital în formulă completă, transmis în direct.",
		videoUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
		logo: ""
	},
	{
		channel: "Canal TV Cultural",
		show: "Portret de Artist",
		year: "2023",
		note: "Interviu + moment acustic în studio.",
		videoUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
		logo: ""
	}
];
const team = {
	vocalists: [
		{
			name: "Florentina Pană",
			role: "Interpretă de muzică populară și ușoară",
			description: "Voce cu timbru cald, prezență scenică elegantă și repertoriu construit pe dinamica evenimentului. Coordonează momentele-cheie astfel încât invitații să rămână conectați de la început până la final.",
			image: "https://placehold.co/400x400/112245/e9f5ff?text=Florentina+Pan%C4%83"
		},
		{
			name: "Cătălin Matei",
			role: "Interpret de Muzică Populară de Petrecere",
			description: "Voce puternică și energie de petrecere autentică. Interacționează natural cu publicul și ridică atmosfera în momentele de dans și tradiție.",
			image: "https://placehold.co/400x400/1b2c52/e9f5ff?text=C%C4%83t%C4%83lin+Matei"
		}
	],
	instrumentalists: [
		{
			name: "Oprea Marian",
			role: "Solist instrumentist - Vioară",
			description: "Intervenții melodice expresive, potrivite pentru intrări speciale, dansul mirilor și momente emoționale cu impact artistic.",
			image: "https://placehold.co/400x400/1a1f3a/f4fff0?text=Oprea+Marian"
		},
		{
			name: "Cristian Ograbek",
			role: "Solist instrumentist - Acordeon",
			description: "Sunet vibrant și ritm de petrecere, cu acompaniament versatil pentru hore, sârbe și momente live cu public implicat.",
			image: "https://placehold.co/400x400/202850/f4fff0?text=Cristian+Ograbek"
		},
		{
			name: "Claudiu Pană",
			role: "Solist instrumentist - Orgă",
			description: "Aranjamente moderne și control armonic excelent, asigurând tranziții fluide între genuri și un sound unitar pentru întregul program.",
			image: "https://placehold.co/400x400/252f5f/f4fff0?text=Claudiu+Pan%C4%83"
		}
	],
	collaborators: [
		{
			instrument: "Saxofon",
			name: "Saxofon",
			role: "Colaborator invitat — Saxofon",
			description: "Intervenții live cu timbru cald și expresiv — potrivit pentru dansul mirilor, momente elegante și seturi de petrecere premium.",
			image: ""
		},
		{
			instrument: "Țambal",
			name: "Țambal",
			role: "Colaborator invitat — Țambal",
			description: "Textură ritmică autentică și sunet vibrant pentru momente de folclor și hore tradiționale.",
			image: ""
		}
	]
};
const gallery = [
	{
		alt: "Moment live la nuntă",
		image: ""
	},
	{
		alt: "Scenă și invitați în dans",
		image: ""
	},
	{
		alt: "Band setup în lumini de scenă",
		image: ""
	},
	{
		alt: "Atmosfera pe ringul de dans",
		image: ""
	},
	{
		alt: "Moment artistic live",
		image: ""
	},
	{
		alt: "Public în energie maximă",
		image: ""
	}
];
const siteContent = {
	brand: brand,
	seo: seo,
	contact: contact,
	socialLinks: socialLinks,
	navigation: navigation,
	videos: videos,
	realMoments: realMoments,
	tvAppearances: tvAppearances,
	team: team,
	gallery: gallery};

const $$Astro$2 = createAstro("https://landing-ul-meu.example.com");
const $$Header = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Header;
  const { brand, navigation } = siteContent;
  const socialLinks = {
    youtube: siteContent.socialLinks?.youtube,
    facebook: siteContent.socialLinks?.facebook,
    instagram: siteContent.socialLinks?.instagram,
    tiktok: siteContent.socialLinks?.tiktok || "https://www.tiktok.com/"
  };
  const isHomePage = Astro2.url.pathname === "/";
  const normalizeNavHref = (href) => {
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return href;
    }
    if (href.startsWith("/")) {
      return href;
    }
    if (href.startsWith("#")) {
      return isHomePage ? href : `/${href}`;
    }
    return `/${href}`;
  };
  const normalizedNavigation = navigation.map((item) => ({
    ...item,
    href: normalizeNavHref(item.href)
  }));
  const topNavigation = normalizedNavigation;
  const desktopNavigation = topNavigation;
  const mobileNavigation = topNavigation;
  const hasExpandableTopMenu = mobileNavigation.length > 1;
  return renderTemplate`${maybeRenderHead()}<header class="top-header fixed inset-x-0 top-0 z-40 border-b border-white/20 bg-ink" data-top-header> <div class="section-container flex items-center justify-between gap-3 py-3"> <a${addAttribute(isHomePage ? "#acasa" : "/#acasa", "href")} class="inline-flex items-center gap-3" aria-label="Mergi la începutul paginii"> <img src="/images/logo-fp-stage.svg" alt="Logo Formația Florentina Pană" class="h-10 w-10 rounded-xl border border-white/20 bg-white/5 p-1 shadow-[0_8px_24px_rgba(245,166,35,0.22)]" loading="eager" decoding="async"> <span class="leading-tight"> <span class="block text-sm font-bold tracking-tight text-white sm:text-base">${brand.name}</span> <span class="hidden text-xs text-white/85 sm:block">Live Band Premium</span> </span> </a> <div class="flex items-center gap-2"> ${hasExpandableTopMenu && renderTemplate`<button type="button" class="btn-outline top-menu-toggle" data-top-menu-toggle aria-expanded="false" aria-controls="top-menu-panel" aria-label="Deschide meniul principal"> <span class="hamburger-lines" aria-hidden="true"> <span class="hamburger-line"></span> <span class="hamburger-line"></span> <span class="hamburger-line"></span> </span> <span class="top-menu-toggle-label">Meniu</span> </button>`} <!-- YouTube — roșu brand oficial --> <a${addAttribute(socialLinks.youtube, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-all duration-200 hover:-translate-y-1 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:#FF0000;box-shadow:0 2px 14px rgba(255,0,0,0.55),0 1px 3px rgba(0,0,0,0.35);" target="_blank" rel="noopener noreferrer" aria-label="Deschide YouTube"> <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" role="img" aria-hidden="true"> <rect x="2" y="6" width="20" height="13" rx="4" fill="#fff"></rect> <polygon points="9.5,9.5 9.5,15.5 16.5,12.5" fill="#FF0000"></polygon> </svg> </a> <!-- Facebook — albastru brand oficial --> <a${addAttribute(socialLinks.facebook, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-all duration-200 hover:-translate-y-1 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:#1877F2;box-shadow:0 2px 14px rgba(24,119,242,0.55),0 1px 3px rgba(0,0,0,0.35);" target="_blank" rel="noopener noreferrer" aria-label="Deschide Facebook"> <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" role="img" aria-hidden="true"> <path d="M13.5 21V14.3H16l.4-2.85H13.5V9.7c0-.82.38-1.2 1.38-1.2H16.5V5.85C16.05 5.77 15.1 5.7 14 5.7c-2.65 0-4.05 1.4-4.05 4.15v1.6H8v2.85h1.95V21H13.5z" fill="#fff"></path> </svg> </a> <!-- Instagram — gradient brand oficial --> <a${addAttribute(socialLinks.instagram, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-all duration-200 hover:-translate-y-1 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:radial-gradient(circle at 30% 110%,#ffd676 0%,#f46f30 25%,#e1306c 55%,#833ab4 80%,#405de6 100%);box-shadow:0 2px 14px rgba(225,48,108,0.55),0 1px 3px rgba(0,0,0,0.35);" target="_blank" rel="noopener noreferrer" aria-label="Deschide Instagram"> <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" role="img" aria-hidden="true"> <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="#fff" stroke-width="2.1"></rect> <circle cx="12" cy="12" r="4.3" stroke="#fff" stroke-width="2"></circle> <circle cx="17.5" cy="6.6" r="1.4" fill="#fff"></circle> </svg> </a> <!-- TikTok — negru brand + efect neon cyan/roșu --> <a${addAttribute(socialLinks.tiktok, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-all duration-200 hover:-translate-y-1 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:#010101;box-shadow:0 2px 14px rgba(254,44,85,0.45),0 1px 3px rgba(0,0,0,0.5);" target="_blank" rel="noopener noreferrer" aria-label="Deschide TikTok"> <svg viewBox="0 0 24 24" class="h-5 w-5" role="img" aria-hidden="true" fill="none"> <!-- strat cyan (umbra stânga-sus) --> <path transform="translate(-0.6,-0.5)" d="M16.5 3h-2.3v11.6a2.8 2.8 0 0 1-2.8 2.8 2.8 2.8 0 0 1-2.8-2.8 2.8 2.8 0 0 1 2.8-2.8c.3 0 .55.05.8.12V9.45a6.2 6.2 0 0 0-.8-.05 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V8.35a8.5 8.5 0 0 0 4.8 1.5V7.3a6.1 6.1 0 0 1-4.5-4.3h-.3z" fill="#25f4ee"></path> <!-- strat roșu (umbra dreapta-jos) --> <path transform="translate(0.6,0.5)" d="M16.5 3h-2.3v11.6a2.8 2.8 0 0 1-2.8 2.8 2.8 2.8 0 0 1-2.8-2.8 2.8 2.8 0 0 1 2.8-2.8c.3 0 .55.05.8.12V9.45a6.2 6.2 0 0 0-.8-.05 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V8.35a8.5 8.5 0 0 0 4.8 1.5V7.3a6.1 6.1 0 0 1-4.5-4.3h-.3z" fill="#fe2c55"></path> <!-- strat alb (fața) --> <path d="M16.5 3h-2.3v11.6a2.8 2.8 0 0 1-2.8 2.8 2.8 2.8 0 0 1-2.8-2.8 2.8 2.8 0 0 1 2.8-2.8c.3 0 .55.05.8.12V9.45a6.2 6.2 0 0 0-.8-.05 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V8.35a8.5 8.5 0 0 0 4.8 1.5V7.3a6.1 6.1 0 0 1-4.5-4.3h-.3z" fill="#fff"></path> </svg> </a> </div> </div> ${hasExpandableTopMenu && renderTemplate`<div id="top-menu-panel" class="top-menu-panel" data-top-menu-panel> <nav class="no-scrollbar section-container flex min-w-0 items-center justify-start gap-4 overflow-x-auto pb-3 text-sm font-medium text-white/90 xl:justify-center" aria-label="Navigație principală"> ${desktopNavigation.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="nav-link nav-link-desktop" data-nav-link> <span class="nav-label">${item.label}</span> </a>`)} ${mobileNavigation.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="nav-link nav-link-mobile" data-nav-link> <span class="nav-label">${item.label}</span> </a>`)} </nav> </div>`} </header> `;
}, "D:/landing-ul meu/src/components/Header.astro", void 0);

const $$Astro$1 = createAstro("https://landing-ul-meu.example.com");
const $$Footer = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Footer;
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const { brand, contact } = siteContent;
  const isHomePage = Astro2.url.pathname === "/";
  return renderTemplate`${maybeRenderHead()}<footer class="border-t border-white/10 bg-[#0C080F] text-white/90"> <div class="section-container grid gap-4 py-8 text-sm md:grid-cols-3 md:items-center"> <div class="inline-flex items-center gap-3"> <img src="/images/logo-fp-stage.svg" alt="Logo Formația Florentina Pană" class="h-10 w-10 rounded-xl border border-white/20 bg-white/5 p-1" loading="lazy" decoding="async"> <p style="color:var(--muted)">© ${year} ${brand.name}. Toate drepturile rezervate.</p> </div> <a${addAttribute(isHomePage ? "#acasa" : "/#acasa", "href")} class="justify-self-start transition hover:text-[#F5A623] md:justify-self-center" style="color: var(--body);">
Înapoi sus
</a> <div class="justify-self-start md:justify-self-end" style="color: var(--body);"> <a${addAttribute(`mailto:${contact.email}`, "href")} class="transition hover:text-[#F5A623]">${contact.email}</a> <span aria-hidden="true" style="color:var(--muted)"> | </span> <a${addAttribute(`tel:${contact.phoneRaw}`, "href")} class="transition hover:text-[#F5A623]">${contact.phoneDisplay}</a> </div> </div> </footer>`;
}, "D:/landing-ul meu/src/components/Footer.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro("https://landing-ul-meu.example.com");
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description, ogImage = "/images/og-placeholder.png" } = Astro2.props;
  const site = Astro2.site?.toString().replace(/\/$/, "") ?? "";
  const canonical = site && Astro2.url ? new URL(Astro2.url.pathname, site).toString() : Astro2.url?.href ?? "";
  const isHomePage = Astro2.url.pathname === "/";
  const sectionLink = (anchor) => isHomePage ? anchor : `/${anchor}`;
  const sideMenuTopItems = [
    { href: sectionLink("#video"), label: "Galerie Video" },
    { href: "/aparitii-tv", label: "Galerie Video Apari\u021Bii TV" },
    { href: "/galerie-foto", label: "Galerie Foto" },
    { href: "/momente-cu-mirii", label: "Momente cu mirii" }
  ];
  const sideMenuBottomItems = [
    { href: "/comunitatea-noastra", label: "Comunitatea noastr\u0103" }
  ];
  return renderTemplate(_a || (_a = __template(['<html lang="ro" class="scroll-smooth"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#0c0f1f">', '<meta property="og:type" content="website"><meta property="og:title"', '><meta property="og:description"', ">", '<meta property="og:image"', '><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', ">", "", '</head> <body class="page-shell"> <a href="#continut" class="skip-link">Sari la con\u021Binut</a> ', ' <div class="layout-content-shell"> <aside class="left-side-menu" aria-label="Acces rapid"> ', " ", ' </aside> <main id="continut" class="flex-1 min-w-0 pt-24 sm:pt-28"> ', " </main> </div> ", " <script>\n      (() => {\n        const root = document.documentElement;\n        let ticking = false;\n\n        const updateScrollProgress = () => {\n          const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;\n          const progress = scrollableHeight > 0 ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;\n          root.style.setProperty('--scroll-progress', progress.toFixed(4));\n        };\n\n        const onScroll = () => {\n          if (ticking) return;\n          ticking = true;\n          requestAnimationFrame(() => {\n            updateScrollProgress();\n            ticking = false;\n          });\n        };\n\n        window.addEventListener('scroll', onScroll, { passive: true });\n        window.addEventListener('resize', updateScrollProgress);\n        updateScrollProgress();\n      })();\n    <\/script> </body> </html>"])), title, addAttribute(description, "content"), canonical && renderTemplate`<link rel="canonical"${addAttribute(canonical, "href")}>`, addAttribute(title, "content"), addAttribute(description, "content"), canonical && renderTemplate`<meta property="og:url"${addAttribute(canonical, "content")}>`, addAttribute(ogImage, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), renderSlot($$result, $$slots["head"]), renderHead(), renderComponent($$result, "Header", $$Header, {}), sideMenuTopItems.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="left-side-link" data-nav-link>${item.label}</a>`), sideMenuBottomItems.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="left-side-link" data-nav-link>${item.label}</a>`), renderSlot($$result, $$slots["default"]), renderComponent($$result, "Footer", $$Footer, {}));
}, "D:/landing-ul meu/src/layouts/BaseLayout.astro", void 0);

export { $$BaseLayout as $, siteContent as s };
