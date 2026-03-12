import { f as createAstro, g as createComponent, m as maybeRenderHead, r as renderTemplate, i as addAttribute, l as renderSlot, n as renderHead, j as renderComponent } from './astro/server_CJG6WAvb.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                                       */

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
		href: "#noutati",
		label: "Noutăți"
	},
	{
		href: "#video",
		label: "Video"
	},
	{
		href: "#aparitii-tv",
		label: "Apariții TV"
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
		href: "#galerie",
		label: "Galerie Foto"
	},
	{
		href: "#faq",
		label: "FAQ"
	},
	{
		href: "#momente-reale",
		label: "Momente Reale"
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
const videoAdmin = {
	maxPerCategory: 6,
	categories: [
		{
			id: "petrecere",
			title: "Muzică Populară & de Petrecere"
		},
		{
			id: "usoara-diverse",
			title: "Muzică Ușoară / Diverse Genuri"
		},
		{
			id: "tineret-manele",
			title: "Tineret"
		}
	]
};
const realMoments = {
	stats: {
		events: "150+",
		reviews: "100+"
	},
	consentNote: "Foto-video publicate cu acordul beneficiarilor.",
	events: [
		{
			title: "Eveniment Andreea & Radu",
			couple: "Andreea & Radu",
			city: "Pitești",
			date: "Septembrie 2025",
			image: "https://placehold.co/900x1200/1a234a/eef6ff?text=Andreea+%26+Radu",
			youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
			coupleQuote: "\"A fost exact cum ne-am dorit: tradiție, eleganță și o atmosferă incredibilă pe ringul de dans.\""
		},
		{
			title: "Eveniment Bianca & Mihai",
			couple: "Bianca & Mihai",
			city: "Curtea de Argeș",
			date: "Iulie 2025",
			image: "https://placehold.co/1200x900/202b5a/eef6ff?text=Bianca+%26+Mihai",
			youtubeUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
			coupleQuote: "\"Invitații au dansat toată noaptea. Formația a avut energie, profesionalism și comunicare perfectă.\""
		},
		{
			title: "Eveniment Ioana & Cătălin",
			couple: "Ioana & Cătălin",
			city: "București",
			date: "Iunie 2025",
			image: "https://placehold.co/900x1200/26336b/eef6ff?text=Ioana+%26+C%C4%83t%C4%83lin",
			youtubeUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
			coupleQuote: "\"Ne-au ascultat toate dorințele muzicale și au creat o atmosferă premium de la început până la final.\""
		},
		{
			title: "Eveniment Alina & Ștefan",
			couple: "Alina & Ștefan",
			city: "Brașov",
			date: "Mai 2025",
			image: "https://placehold.co/1200x900/2b3878/eef6ff?text=Alina+%26+%C8%98tefan",
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
const services = [
	{
		title: "Nunți",
		description: "Program complet pe momente-cheie, de la primirea invitaților până la final."
	},
	{
		title: "Botezuri",
		description: "Atmosferă caldă și repertoriu echilibrat pentru invitați de toate vârstele."
	},
	{
		title: "Corporate",
		description: "Setlist premium și prezență scenică profesionistă pentru evenimente business."
	}
];
const repertoire = [
	{
		label: "Pop românesc și internațional",
		details: "Repertoriu reprezentativ (12 piese):\n1. Holograf - Ti-am dat un inel\n2. Voltaj - 20\n3. Vama - Perfect fără tine\n4. Andra - Iubirea schimbă tot\n5. Smiley - Acasă\n6. Carla's Dreams - Sub pielea mea\n7. Whitney Houston - I Wanna Dance with Somebody\n8. ABBA - Dancing Queen\n9. George Michael - Careless Whisper\n10. Adele - Rolling in the Deep\n11. Bruno Mars - Just the Way You Are\n12. Ed Sheeran - Perfect"
	},
	{
		label: "Dance și hituri actuale",
		details: "Repertoriu reprezentativ (12 piese):\n1. Dua Lipa - Dance The Night\n2. The Weeknd - Blinding Lights\n3. Calvin Harris & Ellie Goulding - Miracle\n4. David Guetta & Bebe Rexha - I'm Good (Blue)\n5. Ava Max - Kings & Queens\n6. Minelli - Rampampam\n7. INNA - Up\n8. Alok, Sigala & Ellie Goulding - All By Myself\n9. Shakira & Bizarrap - Bzrp Music Sessions, Vol. 53\n10. Rema - Calm Down\n11. Jax Jones & MNEK - Where Did You Go?\n12. Purple Disco Machine & Sophie and the Giants - Hypnotized"
	},
	{
		label: "Muzică de petrecere",
		details: "Repertoriu reprezentativ (12 piese):\n1. Ia-ți mireasă ziua bună\n2. Ia-ți mireasă rămas bun\n3. Cârligu' Mare\n4. Hora din Moldova\n5. Sârba lui Pompieru\n6. Ciuleandra\n7. Trandafir de la Moldova\n8. Foaie verde 5 chiperi\n9. M-a făcut mama oltean\n10. La Chilia-n port\n11. Hai lume la joc\n12. Azi e nuntă noastră"
	},
	{
		label: "Momente speciale personalizate",
		details: "Repertoriu reprezentativ (10 piese):\n1. Christina Perri - A Thousand Years (dansul mirilor)\n2. Ed Sheeran - Perfect (dansul mirilor)\n3. Elvis Presley - Can't Help Falling in Love (dans lent)\n4. Etta James - At Last (moment romantic)\n5. Celine Dion - The Power of Love (intrare elegantă)\n6. Queen - Don't Stop Me Now (moment tort)\n7. Pharrell Williams - Happy (moment surpriză)\n8. Bruno Mars - Marry You (intrare invitați)\n9. Coldplay - A Sky Full of Stars (final energetic)\n10. Andra - Iubirea schimbă tot (moment dedicat familiei)"
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
			description: "Invitat special pentru intervenții live cu timbru cald și expresiv."
		},
		{
			instrument: "Țambal",
			description: "Textură ritmică autentică pentru momente de folclor."
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
const faq = [
	{
		question: "Cântați în toată țara?",
		answer: "Da. Ne deplasăm oriunde în România, în funcție de disponibilitate."
	},
	{
		question: "Putem alege repertoriul?",
		answer: "Da. Stabilim împreună direcția muzicală și momentele speciale."
	},
	{
		question: "Cât durează un program complet?",
		answer: "Prestație artistică fără pauze, aproximativ 7-8 ore"
	}
];
const siteContent = {
	brand: brand,
	seo: seo,
	contact: contact,
	socialLinks: socialLinks,
	navigation: navigation,
	videos: videos,
	videoAdmin: videoAdmin,
	realMoments: realMoments,
	tvAppearances: tvAppearances,
	services: services,
	repertoire: repertoire,
	team: team,
	gallery: gallery,
	faq: faq
};

const $$Astro$1 = createAstro("https://landing-ul-meu.example.com");
const $$Header = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Header;
  const { brand, navigation, contact } = siteContent;
  const leftRailHrefs = /* @__PURE__ */ new Set(["#acasa", "#noutati", "#video", "#aparitii-tv", "#galerie", "#contact"]);
  const leftRailLabelTokens = ["acasa", "noutati", "video", "aparitii", "galerie", "contact"];
  const isHomePage = Astro2.url.pathname === "/";
  const normalizedNavigation = navigation.map((item) => ({
    ...item,
    href: isHomePage ? item.href : `/${item.href}`
  }));
  const normalizeText = (value) => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const topNavigation = normalizedNavigation.filter((item) => {
    const normalizedHref = item.href.replace(/^\//, "");
    const normalizedLabel = normalizeText(item.label);
    const isLeftRailHref = leftRailHrefs.has(normalizedHref);
    const isLeftRailLabel = leftRailLabelTokens.some((token) => normalizedLabel.includes(token));
    return !isLeftRailHref && !isLeftRailLabel;
  });
  const mobileNavigation = [
    ...topNavigation,
    { href: "/comunitatea-noastra", label: "Comunitatea noastr\u0103" }
  ];
  const hasExpandableTopMenu = mobileNavigation.length > 1;
  return renderTemplate`${maybeRenderHead()}<header class="top-header fixed inset-x-0 top-0 z-40 border-b border-white/20 bg-ink" data-top-header> <div class="section-container flex items-center justify-between gap-3 py-3"> <a href="#acasa" class="inline-flex items-center gap-3" aria-label="Mergi la începutul paginii"> <img src="/images/logo-fp-stage.svg" alt="Logo Formația Florentina Pană" class="h-10 w-10 rounded-xl border border-white/25 bg-white/5 p-1 shadow-[0_8px_24px_rgba(94,238,255,0.22)]" loading="eager" decoding="async"> <span class="leading-tight"> <span class="block text-sm font-bold tracking-tight text-white sm:text-base">${brand.name}</span> <span class="hidden text-xs text-white/85 sm:block">Live Band Premium</span> </span> </a> <div class="flex items-center gap-2"> ${hasExpandableTopMenu && renderTemplate`<button type="button" class="btn-outline top-menu-toggle" data-top-menu-toggle aria-expanded="false" aria-controls="top-menu-panel" aria-label="Deschide meniul principal"> <span class="hamburger-lines" aria-hidden="true"> <span class="hamburger-line"></span> <span class="hamburger-line"></span> <span class="hamburger-line"></span> </span> <span class="top-menu-toggle-label">Meniu</span> </button>`} <a${addAttribute(`tel:${contact.phoneRaw}`, "href")} class="btn-outline hidden whitespace-nowrap xl:inline-flex" aria-label="Sunați formația acum">
Rezervare rapidă
</a> </div> </div> ${hasExpandableTopMenu && renderTemplate`<div id="top-menu-panel" class="top-menu-panel" data-top-menu-panel> <nav class="no-scrollbar section-container flex min-w-0 items-center justify-start gap-4 overflow-x-auto pb-3 text-sm font-medium text-white/90 xl:justify-center" aria-label="Navigație principală"> ${topNavigation.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="nav-link nav-link-desktop" data-nav-link> <span class="nav-label">${item.label}</span> </a>`)} ${mobileNavigation.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="nav-link nav-link-mobile" data-nav-link> <span class="nav-label">${item.label}</span> </a>`)} </nav> </div>`} </header> `;
}, "D:/landing-ul meu/src/components/Header.astro", void 0);

const $$Footer = createComponent(($$result, $$props, $$slots) => {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const { brand, contact } = siteContent;
  return renderTemplate`${maybeRenderHead()}<footer class="border-t border-white/20 bg-ink text-white/90"> <div class="section-container grid gap-4 py-8 text-sm md:grid-cols-3 md:items-center"> <div class="inline-flex items-center gap-3"> <img src="/images/logo-fp-stage.svg" alt="Logo Formația Florentina Pană" class="h-10 w-10 rounded-xl border border-white/20 bg-white/5 p-1" loading="lazy" decoding="async"> <p>© ${year} ${brand.name}. Toate drepturile rezervate.</p> </div> <a href="#acasa" class="justify-self-start text-white transition hover:text-lime-200 md:justify-self-center">
Înapoi sus
</a> <div class="justify-self-start text-white/90 md:justify-self-end"> <a${addAttribute(`mailto:${contact.email}`, "href")} class="transition hover:text-cyan-200">${contact.email}</a> <span aria-hidden="true"> | </span> <a${addAttribute(`tel:${contact.phoneRaw}`, "href")} class="transition hover:text-cyan-200">${contact.phoneDisplay}</a> </div> </div> </footer>`;
}, "D:/landing-ul meu/src/components/Footer.astro", void 0);

const $$Astro = createAstro("https://landing-ul-meu.example.com");
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description, ogImage = "/images/og-placeholder.png" } = Astro2.props;
  const site = Astro2.site?.toString().replace(/\/$/, "") ?? "";
  const canonical = site && Astro2.url ? new URL(Astro2.url.pathname, site).toString() : Astro2.url?.href ?? "";
  const socialLinks = {
    youtube: siteContent.socialLinks?.youtube,
    facebook: siteContent.socialLinks?.facebook,
    instagram: siteContent.socialLinks?.instagram
  };
  const isHomePage = Astro2.url.pathname === "/";
  const sectionLink = (anchor) => isHomePage ? anchor : `/${anchor}`;
  const sideMenuTopItems = [
    { href: sectionLink("#acasa"), label: "Acas\u0103" },
    { href: sectionLink("#video"), label: "Galerie Video" },
    { href: sectionLink("#aparitii-tv"), label: "Galerie Video Apari\u021Bii TV" },
    { href: sectionLink("#galerie"), label: "Galerie Foto" }
  ];
  const sideMenuBottomItems = [
    { href: "/comunitatea-noastra", label: "Comunitatea noastr\u0103" },
    { href: sectionLink("#contact"), label: "Contact" }
  ];
  return renderTemplate`<html lang="ro" class="scroll-smooth"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description"${addAttribute(description, "content")}><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#0c0f1f">${canonical && renderTemplate`<link rel="canonical"${addAttribute(canonical, "href")}>`}<meta property="og:type" content="website"><meta property="og:title"${addAttribute(title, "content")}><meta property="og:description"${addAttribute(description, "content")}>${canonical && renderTemplate`<meta property="og:url"${addAttribute(canonical, "content")}>`}<meta property="og:image"${addAttribute(ogImage, "content")}><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"${addAttribute(title, "content")}><meta name="twitter:description"${addAttribute(description, "content")}><meta name="twitter:image"${addAttribute(ogImage, "content")}>${renderSlot($$result, $$slots["head"])}${renderHead()}</head> <body class="page-shell"> <a href="#continut" class="skip-link">Sari la conținut</a> ${renderComponent($$result, "Header", $$Header, {})} <aside class="left-side-menu" aria-label="Acces rapid"> ${sideMenuTopItems.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="left-side-link" data-nav-link>${item.label}</a>`)} <div class="left-side-logistics" aria-label="Logistică site și social media"> <p class="left-side-logistics-title">Logistică site</p> <a${addAttribute(socialLinks.youtube, "href")} class="left-side-link left-side-link-social social-youtube" target="_blank" rel="noopener noreferrer" aria-label="Deschide YouTube"> <span class="social-icon" aria-hidden="true"> <svg viewBox="0 0 24 24" fill="none" role="img"> <path d="M22 12C22 9.35 21.77 7.91 21.53 7.02C21.34 6.3 20.78 5.74 20.06 5.55C18.75 5.2 12 5.2 12 5.2C12 5.2 5.25 5.2 3.94 5.55C3.22 5.74 2.66 6.3 2.47 7.02C2.23 7.91 2 9.35 2 12C2 14.65 2.23 16.09 2.47 16.98C2.66 17.7 3.22 18.26 3.94 18.45C5.25 18.8 12 18.8 12 18.8C12 18.8 18.75 18.8 20.06 18.45C20.78 18.26 21.34 17.7 21.53 16.98C21.77 16.09 22 14.65 22 12Z" fill="currentColor"></path> <path d="M10 15.5V8.5L16 12L10 15.5Z" fill="#ffffff"></path> </svg> </span> <span>YouTube</span> </a> <a${addAttribute(socialLinks.facebook, "href")} class="left-side-link left-side-link-social social-facebook" target="_blank" rel="noopener noreferrer" aria-label="Deschide Facebook"> <span class="social-icon" aria-hidden="true"> <svg viewBox="0 0 24 24" fill="none" role="img"> <path d="M24 12.07C24 5.4 18.63 0 12 0C5.37 0 0 5.4 0 12.07C0 18.09 4.39 23.08 10.12 24V15.56H7.08V12.07H10.12V9.41C10.12 6.39 11.91 4.72 14.66 4.72C15.98 4.72 17.37 4.96 17.37 4.96V7.93H15.84C14.34 7.93 13.88 8.87 13.88 9.84V12.07H17.23L16.69 15.56H13.88V24C19.61 23.08 24 18.09 24 12.07Z" fill="currentColor"></path> </svg> </span> <span>Facebook</span> </a> <a${addAttribute(socialLinks.instagram, "href")} class="left-side-link left-side-link-social social-instagram" target="_blank" rel="noopener noreferrer" aria-label="Deschide Instagram"> <span class="social-icon" aria-hidden="true"> <svg viewBox="0 0 24 24" fill="none" role="img"> <rect x="2.3" y="2.3" width="19.4" height="19.4" rx="6" stroke="currentColor" stroke-width="2.2"></rect> <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="2.2"></circle> <circle cx="17.45" cy="6.55" r="1.2" fill="currentColor"></circle> </svg> </span> <span>Instagram</span> </a> </div> ${sideMenuBottomItems.map((item) => renderTemplate`<a${addAttribute(item.href, "href")} class="left-side-link" data-nav-link>${item.label}</a>`)} </aside> <main id="continut" class="flex-1 pt-24 sm:pt-28 lg:pl-24"> ${renderSlot($$result, $$slots["default"])} </main> ${renderComponent($$result, "Footer", $$Footer, {})} </body></html>`;
}, "D:/landing-ul meu/src/layouts/BaseLayout.astro", void 0);

export { $$BaseLayout as $, siteContent as s };
