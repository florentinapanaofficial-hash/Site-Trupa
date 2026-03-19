import { f as createAstro, g as createComponent, m as maybeRenderHead, i as addAttribute, r as renderTemplate, j as renderComponent, l as renderSlot, n as renderHead, u as unescapeHTML } from './astro/server_CJG6WAvb.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                               */

const brand = {
	name: "Formația Florentina Pană",
	bandPhoto: "",
	aboutIntro: "Formația Florentina Pană este o trupă de muzică live cu experiență vastă în evenimente private, nunți, botezuri și petreceri corporate. Punem accent pe energie, emoție și profesionalism, oferind un spectacol complet care ridică publicul în picioare.",
	aboutIntro2: "Repertoriul acoperă muzică populară românească, ușoară, cover-uri internaționale, muzică de petrecere și momente speciale personalizate pentru fiecare eveniment."
};
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
		href: "/momente-cu-mirii",
		label: "Momente cu mirii",
		color: "cyan"
	},
	{
		href: "/comunitatea-noastra",
		label: "Comunitatea noastră",
		color: "cyan"
	},
	{
		href: "/aparitii-tv",
		label: "Apariții TV",
		color: "cyan"
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
	},
	{
		title: "Muzică ușoară - voce și instrumente",
		youtubeId: "GRwVkbUGVPs",
		youtubeUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
		category: "usoara-diverse"
	},
	{
		title: "Tineret - moment live manele",
		youtubeId: "HQfVn98caic",
		youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
		category: "tineret-manele"
	},
	{
		title: "Tineret - energie și atmosferă",
		youtubeId: "7MQIWMj_W0g",
		youtubeUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
		category: "tineret-manele"
	},
	{
		title: "Tineret - show live complet",
		youtubeId: "aDB9Aa9cFLY",
		youtubeUrl: "https://www.youtube.com/watch?v=aDB9Aa9cFLY",
		category: "tineret-manele"
	},
	{
		title: "Muzică instrumentală - moment live",
		youtubeId: "FyrQQqFMZvg",
		youtubeUrl: "https://www.youtube.com/watch?v=FyrQQqFMZvg",
		category: "instrumentala"
	},
	{
		title: "Muzică instrumentală - recital",
		youtubeId: "OSrEJczdKuw",
		youtubeUrl: "https://www.youtube.com/watch?v=OSrEJczdKuw",
		category: "instrumentala"
	},
	{
		title: "Muzică instrumentală - atmosferă",
		youtubeId: "LSd5N1AmiFg",
		youtubeUrl: "https://www.youtube.com/watch?v=LSd5N1AmiFg",
		category: "instrumentala"
	},
	{
		title: "Dansul Mirilor - Andreea & Radu",
		youtubeId: "HQfVn98caic",
		youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
		category: "dans-miri"
	},
	{
		title: "Dansul Mirilor - Bianca & Mihai",
		youtubeId: "7MQIWMj_W0g",
		youtubeUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
		category: "dans-miri"
	},
	{
		title: "Dansul Mirilor - Ioana & Cătălin",
		youtubeId: "GRwVkbUGVPs",
		youtubeUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
		category: "dans-miri"
	},
	{
		title: "Dansul Mirilor - Alina & Ștefan",
		youtubeId: "xdcdjAtxZlA",
		youtubeUrl: "https://www.youtube.com/watch?v=xdcdjAtxZlA",
		category: "dans-miri"
	}
];
const realMoments = {
	stats: {
		events: "150+"},
	events: [
		{
			title: "Eveniment Andreea & Radu",
			couple: "Andreea & Radu",
			city: "Pitești",
			date: "Septembrie 2025",
			image: "https://placehold.co/1600x900/1a234a/eef6ff?text=Andreea+%26+Radu",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
			coupleQuote: "\"A fost exact cum ne-am dorit: tradiție, eleganță și o atmosferă incredibilă pe ringul de dans.\"",
			accentColor: "#e8325a",
			accentGlow: "rgba(232,50,90,0.35)",
			blogSlug: "andreea-si-radu-povestea-lor"
		},
		{
			title: "Eveniment Bianca & Mihai",
			couple: "Bianca & Mihai",
			city: "Curtea de Argeș",
			date: "Iulie 2025",
			image: "https://placehold.co/1600x900/202b5a/eef6ff?text=Bianca+%26+Mihai",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=7MQIWMj_W0g",
			coupleQuote: "\"Invitații au dansat toată noaptea. Formația a avut energie, profesionalism și comunicare perfectă.\"",
			accentColor: "#f5a623",
			accentGlow: "rgba(245,166,35,0.35)",
			blogSlug: "bianca-si-mihai-povestea-lor"
		},
		{
			title: "Eveniment Ioana & Cătălin",
			couple: "Ioana & Cătălin",
			city: "București",
			date: "Iunie 2025",
			image: "https://placehold.co/1600x900/26336b/eef6ff?text=Ioana+%26+C%C4%83t%C4%83lin",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=GRwVkbUGVPs",
			coupleQuote: "\"Ne-au ascultat toate dorințele muzicale și au creat o atmosferă premium de la început până la final.\"",
			accentColor: "#0bbcd6",
			accentGlow: "rgba(11,188,214,0.30)",
			blogSlug: "ioana-si-catalin-povestea-lor"
		},
		{
			title: "Eveniment Alina & Ștefan",
			couple: "Alina & Ștefan",
			city: "Brașov",
			date: "Mai 2025",
			image: "https://placehold.co/1600x900/2b3878/eef6ff?text=Alina+%26+%C8%98tefan",
			audioUrl: "",
			youtubeUrl: "https://www.youtube.com/watch?v=HQfVn98caic",
			coupleQuote: "\"O echipă de nota 10! Au ridicat sala în picioare și au făcut din seara noastră o amintire de neuitat.\"",
			accentColor: "#a855f7",
			accentGlow: "rgba(168,85,247,0.30)",
			blogSlug: "alina-si-stefan-povestea-lor"
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
		icon: "💍",
		title: "Nuntă",
		description: "Program complet de la primire până la petrecere, momente speciale și atmosferă garantată.",
		details: "Oferim un program complet pentru nunta voastră: primirea invitaților, cina, dansul mirilor, momente dedicate părinților, dansul la tăierea tortului și petrecerea de noapte. Colaborăm cu cuplul înainte de eveniment pentru a personaliza fiecare moment muzical. Durata standard: 6-8 ore cu pauze."
	},
	{
		icon: "🍼",
		title: "Botez",
		description: "Muzică live caldă, repertoriu special, emoție autentică pentru cel mai important prim pas.",
		details: "Creăm o atmosferă festivă și emoționantă potrivită pentru botez: muzică ușoară, piese populare &amp; romanțe pentru generații mai în vârstă și ritmuri moderne pentru tineri. Repertoriul este echilibrat pentru invitați de toate vârstele. Durata standard: 4-6 ore."
	},
	{
		icon: "🏢",
		title: "Corporate",
		description: "Show profesionist, rafinat, perfect pentru gale, team-building-uri și lansări de produse.",
		details: "Adaptăm setul muzical complet pentru evenimente business: gale de premiere, seri de team-building, lansări de produse sau petreceri de Crăciun. Muzică de fundal elegantă în timpul serii, moment live de show, repertoriu rafinat cu hituri cunoscute."
	},
	{
		icon: "🎸",
		title: "Concert",
		description: "Set-uri complete de concert live, cu repertoriu adaptat publicului și logistică proprie.",
		details: "Putem susține concerte autonome sau deschideri de eveniment: set complet de 2-3 ore, echipament propriu de sunet și lumină, coregrafie scenică adaptată. Repertoriu dinamic cu hituri românești și internaționale, moment de public interaction și final energetic."
	}
];
const repertoire = [
	{
		icon: "🎶",
		label: "Pop românesc și internațional",
		details: "Repertoriu reprezentativ (12 piese):\n1. Holograf - Ti-am dat un inel\n2. Voltaj - 20\n3. Vama - Perfect fără tine\n4. Andra - Iubirea schimbă tot\n5. Smiley - Acasă\n6. Carla's Dreams - Sub pielea mea\n7. Whitney Houston - I Wanna Dance with Somebody\n8. ABBA - Dancing Queen\n9. George Michael - Careless Whisper\n10. Adele - Rolling in the Deep\n11. Bruno Mars - Just the Way You Are\n12. Ed Sheeran - Perfect"
	},
	{
		icon: "🎧",
		label: "Dance și hituri actuale",
		details: "Repertoriu reprezentativ (12 piese):\n1. Dua Lipa - Dance The Night\n2. The Weeknd - Blinding Lights\n3. Calvin Harris & Ellie Goulding - Miracle\n4. David Guetta & Bebe Rexha - I'm Good (Blue)\n5. Ava Max - Kings & Queens\n6. Minelli - Rampampam\n7. INNA - Up\n8. Alok, Sigala & Ellie Goulding - All By Myself\n9. Shakira & Bizarrap - Bzrp Music Sessions, Vol. 53\n10. Rema - Calm Down\n11. Jax Jones & MNEK - Where Did You Go?\n12. Purple Disco Machine & Sophie and the Giants - Hypnotized"
	},
	{
		icon: "🎻",
		label: "Muzică de petrecere",
		details: "Repertoriu reprezentativ (12 piese):\n1. Ia-ți mireasă ziua bună\n2. Ia-ți mireasă rămas bun\n3. Cârligu' Mare\n4. Hora din Moldova\n5. Sârba lui Pompieru\n6. Ciuleandra\n7. Trandafir de la Moldova\n8. Foaie verde 5 chiperi\n9. M-a făcut mama oltean\n10. La Chilia-n port\n11. Hai lume la joc\n12. Azi e nuntă noastră"
	},
	{
		icon: "💫",
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
			image: "https://placehold.co/400x400/112245/e9f5ff?text=Florentina+Pan%C4%83",
			photos: [
				"",
				"",
				"",
				"",
				"",
				""
			]
		},
		{
			name: "Cătălin Matei",
			role: "Interpret de Muzică Populară de Petrecere",
			description: "Voce puternică și energie de petrecere autentică. Interacționează natural cu publicul și ridică atmosfera în momentele de dans și tradiție.",
			image: "https://placehold.co/400x400/1b2c52/e9f5ff?text=C%C4%83t%C4%83lin+Matei",
			photos: [
				"",
				"",
				"",
				"",
				"",
				""
			]
		}
	],
	instrumentalists: [
		{
			name: "Oprea Marian",
			role: "Solist instrumentist - Vioară",
			description: "Intervenții melodice expresive, potrivite pentru intrări speciale, dansul mirilor și momente emoționale cu impact artistic.",
			image: "https://placehold.co/400x400/1a1f3a/f4fff0?text=Oprea+Marian",
			photos: [
				"",
				"",
				"",
				"",
				"",
				""
			]
		},
		{
			name: "Cristian Ograbek",
			role: "Solist instrumentist - Acordeon",
			description: "Sunet vibrant și ritm de petrecere, cu acompaniament versatil pentru hore, sârbe și momente live cu public implicat.",
			image: "https://placehold.co/400x400/202850/f4fff0?text=Cristian+Ograbek",
			photos: [
				"",
				"",
				"",
				"",
				"",
				""
			]
		},
		{
			name: "Claudiu Pană",
			role: "Solist instrumentist - Orgă",
			description: "Aranjamente moderne și control armonic excelent, asigurând tranziții fluide între genuri și un sound unitar pentru întregul program.",
			image: "https://placehold.co/400x400/252f5f/f4fff0?text=Claudiu+Pan%C4%83",
			photos: [
				"",
				"",
				"",
				"",
				"",
				""
			]
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
	realMoments: realMoments,
	tvAppearances: tvAppearances,
	services: services,
	repertoire: repertoire,
	team: team,
	gallery: gallery,
	faq: faq
};

const $$Astro$2 = createAstro("https://florentinapanaofficial.ro");
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
  return renderTemplate`${maybeRenderHead()}<header class="top-header fixed inset-x-0 top-0 z-40 border-b border-white/20 bg-ink" data-top-header> <div class="section-container flex items-center justify-between gap-3 py-3"> <a${addAttribute(isHomePage ? "#acasa" : "/#acasa", "href")} class="inline-flex items-center gap-3" aria-label="Mergi la începutul paginii"> <img src="/images/logo-fp-stage.svg" alt="Logo Formația Florentina Pană" class="h-10 w-10 rounded-xl border border-white/20 bg-white/5 p-1 shadow-[0_8px_24px_rgba(245,166,35,0.22)]" loading="eager" decoding="async"> <span class="leading-tight"> <span class="block text-sm font-bold tracking-tight text-white sm:text-base">${brand.name}</span> <span class="hidden text-xs text-white/85 sm:block">Live Band Premium</span> </span> </a> <div class="flex items-center gap-2"> ${hasExpandableTopMenu && renderTemplate`<button type="button" class="btn-outline top-menu-toggle" data-top-menu-toggle aria-expanded="false" aria-controls="top-menu-panel" aria-label="Deschide meniul principal"> <span class="hamburger-lines" aria-hidden="true"> <span class="hamburger-line"></span> <span class="hamburger-line"></span> <span class="hamburger-line"></span> </span> <span class="top-menu-toggle-label">Meniu</span> </button>`} <!-- YouTube — roșu brand oficial --> <a${addAttribute(socialLinks.youtube, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:#FF0000;box-shadow:0 2px 14px rgba(255,0,0,0.55),0 1px 3px rgba(0,0,0,0.35);" target="_blank" rel="noopener noreferrer" aria-label="Deschide YouTube"> <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" role="img" aria-hidden="true"> <rect x="2" y="6" width="20" height="13" rx="4" fill="#fff"></rect> <polygon points="9.5,9.5 9.5,15.5 16.5,12.5" fill="#FF0000"></polygon> </svg> </a> <!-- Facebook — albastru brand oficial --> <a${addAttribute(socialLinks.facebook, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:#1877F2;box-shadow:0 2px 14px rgba(24,119,242,0.55),0 1px 3px rgba(0,0,0,0.35);" target="_blank" rel="noopener noreferrer" aria-label="Deschide Facebook"> <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" role="img" aria-hidden="true"> <path d="M13.5 21V14.3H16l.4-2.85H13.5V9.7c0-.82.38-1.2 1.38-1.2H16.5V5.85C16.05 5.77 15.1 5.7 14 5.7c-2.65 0-4.05 1.4-4.05 4.15v1.6H8v2.85h1.95V21H13.5z" fill="#fff"></path> </svg> </a> <!-- Instagram — gradient brand oficial --> <a${addAttribute(socialLinks.instagram, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:radial-gradient(circle at 30% 110%,#ffd676 0%,#f46f30 25%,#e1306c 55%,#833ab4 80%,#405de6 100%);box-shadow:0 2px 14px rgba(225,48,108,0.55),0 1px 3px rgba(0,0,0,0.35);" target="_blank" rel="noopener noreferrer" aria-label="Deschide Instagram"> <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" role="img" aria-hidden="true"> <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="#fff" stroke-width="2.1"></rect> <circle cx="12" cy="12" r="4.3" stroke="#fff" stroke-width="2"></circle> <circle cx="17.5" cy="6.6" r="1.4" fill="#fff"></circle> </svg> </a> <!-- TikTok — negru brand + efect neon cyan/roșu --> <a${addAttribute(socialLinks.tiktok, "href")} class="inline-grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style="background:#010101;border:1.5px solid rgba(255,255,255,0.55);box-shadow:0 2px 14px rgba(254,44,85,0.45),0 1px 3px rgba(0,0,0,0.5);" target="_blank" rel="noopener noreferrer" aria-label="Deschide TikTok"> <svg viewBox="0 0 24 24" class="h-5 w-5" role="img" aria-hidden="true" fill="none"> <!-- strat cyan (umbra stânga-sus) --> <path transform="translate(-0.6,-0.5)" d="M16.5 3h-2.3v11.6a2.8 2.8 0 0 1-2.8 2.8 2.8 2.8 0 0 1-2.8-2.8 2.8 2.8 0 0 1 2.8-2.8c.3 0 .55.05.8.12V9.45a6.2 6.2 0 0 0-.8-.05 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V8.35a8.5 8.5 0 0 0 4.8 1.5V7.3a6.1 6.1 0 0 1-4.5-4.3h-.3z" fill="#25f4ee"></path> <!-- strat roșu (umbra dreapta-jos) --> <path transform="translate(0.6,0.5)" d="M16.5 3h-2.3v11.6a2.8 2.8 0 0 1-2.8 2.8 2.8 2.8 0 0 1-2.8-2.8 2.8 2.8 0 0 1 2.8-2.8c.3 0 .55.05.8.12V9.45a6.2 6.2 0 0 0-.8-.05 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V8.35a8.5 8.5 0 0 0 4.8 1.5V7.3a6.1 6.1 0 0 1-4.5-4.3h-.3z" fill="#fe2c55"></path> <!-- strat alb (fața) --> <path d="M16.5 3h-2.3v11.6a2.8 2.8 0 0 1-2.8 2.8 2.8 2.8 0 0 1-2.8-2.8 2.8 2.8 0 0 1 2.8-2.8c.3 0 .55.05.8.12V9.45a6.2 6.2 0 0 0-.8-.05 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V8.35a8.5 8.5 0 0 0 4.8 1.5V7.3a6.1 6.1 0 0 1-4.5-4.3h-.3z" fill="#fff"></path> </svg> </a> </div> </div> ${hasExpandableTopMenu && renderTemplate`<div id="top-menu-panel" class="top-menu-panel" data-top-menu-panel> <nav class="no-scrollbar section-container flex min-w-0 items-center justify-start gap-4 overflow-x-auto pb-3 text-sm font-medium text-white/90 xl:justify-center" aria-label="Navigație principală"> ${desktopNavigation.map((item) => renderTemplate`<a${addAttribute(item.href, "href")}${addAttribute(`left-side-link nav-link-desktop${item.color ? ` nav-btn-${item.color}` : ""}`, "class")} data-nav-link> <span class="nav-label">${item.label}</span> </a>`)} ${mobileNavigation.map((item) => renderTemplate`<a${addAttribute(item.href, "href")}${addAttribute(`left-side-link nav-link-mobile${item.color ? ` nav-btn-${item.color}` : ""}`, "class")} data-nav-link> <span class="nav-label">${item.label}</span> </a>`)} </nav> </div>`} </header> `;
}, "D:/landing-ul meu/src/components/Header.astro", void 0);

const $$Astro$1 = createAstro("https://florentinapanaofficial.ro");
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

const $$SkyBackground = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<!-- Cer albastru 2D — fără JS -->${maybeRenderHead()}<div id="sky-bg-2d" aria-hidden="true"></div> <div id="sky-vignette" aria-hidden="true"></div>`;
}, "D:/landing-ul meu/src/components/SkyBackground.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _c;
const $$Astro = createAstro("https://florentinapanaofficial.ro");
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description, ogType = "website" } = Astro2.props;
  const SITE_FALLBACK = "https://florentinapanaofficial.ro";
  const site = Astro2.site?.toString().replace(/\/$/, "") ?? SITE_FALLBACK;
  const canonical = new URL(Astro2.url.pathname, site).toString();
  const rawOgImage = Astro2.props.ogImage ?? "/images/og-default-1200x630.jpg";
  const ogImage = rawOgImage.startsWith("http") ? rawOgImage : `${site}${rawOgImage}`;
  const ga4Id = undefined                             ;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["MusicGroup", "LocalBusiness"],
    name: siteContent.brand.name,
    description: siteContent.seo.description,
    url: site || "",
    telephone: siteContent.contact.phoneRaw,
    email: siteContent.contact.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Pitești",
      addressRegion: "Argeș",
      addressCountry: "RO"
    },
    sameAs: [
      siteContent.socialLinks?.youtube,
      siteContent.socialLinks?.facebook,
      siteContent.socialLinks?.instagram
    ].filter(Boolean)
  };
  Astro2.url.pathname === "/";
  const sideMenuTopItems = [
    { href: "/", label: "Acasă", color: "cyan" },
    { href: "/galerie-video", label: "Galerie Video", color: "cyan" },
    { href: "/galerie-foto", label: "Galerie Foto", color: "cyan" },
    { href: "/#membri", label: "Membri", color: "cyan" },
    { href: "/despre", label: "Despre", color: "cyan" },
    { href: "/contact", label: "Contact", color: "cyan" }
  ];
  const sideMenuBottomItems = [];
  return renderTemplate(_c || (_c = __template(['<html lang="ro" class="scroll-smooth"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#0c0f1f">', '<meta property="og:type"', '><meta property="og:title"', '><meta property="og:description"', ">", '<meta property="og:image"', '><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ro_RO"><meta property="og:site_name"', '><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><link rel="icon" type="image/svg+xml" href="/images/logo-fp-stage.svg"><script type="application/ld+json">', "</script>", "", "", "", '</head> <body class="page-shell"> <a href="#continut" class="skip-link">Sari la conținut</a> ', " ", ' <div class="layout-content-shell"> <aside class="left-side-menu" aria-label="Acces rapid"> ', " ", ' </aside> <main id="continut" class="flex-1 min-w-0 pt-40 sm:pt-44"> ', " </main> </div> ", " <script>\n      (() => {\n        const root = document.documentElement;\n        let ticking = false;\n\n        const updateScrollProgress = () => {\n          const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;\n          const progress = scrollableHeight > 0 ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;\n          root.style.setProperty('--scroll-progress', progress.toFixed(4));\n        };\n\n        const onScroll = () => {\n          if (ticking) return;\n          ticking = true;\n          requestAnimationFrame(() => {\n            updateScrollProgress();\n            ticking = false;\n          });\n        };\n\n        window.addEventListener('scroll', onScroll, { passive: true });\n        window.addEventListener('resize', updateScrollProgress);\n        updateScrollProgress();\n      })();\n    </script> <script>\n      // Scroll spy sidebar — activare buton la derulare\n      (() => {\n        const menu = document.querySelector('.left-side-menu');\n        if (!menu) return;\n        const links = Array.from(menu.querySelectorAll('.left-side-link'));\n\n        // Mapare explicită: id secțiune din homepage → href buton sidebar\n        const sectionToHref = {\n          'acasa':   '/',\n          'video':   '/galerie-video',\n          'membri':  '/#membri',\n          'galerie': '/galerie-foto',\n        };\n\n        function setActive(href) {\n          menu.classList.remove('has-active');\n          links.forEach(l => l.classList.remove('is-active'));\n          const match = links.find(l => l.getAttribute('href') === href);\n          if (match) {\n            match.classList.add('is-active');\n            menu.classList.add('has-active');\n          }\n        }\n\n        // Potrivire inițială după pathname\n        function currentHref() {\n          const path = location.pathname.replace(/\\/$/, '') || '/';\n          const hash = location.hash;\n          const full = path + hash;\n          if (links.some(l => l.getAttribute('href') === full)) return full;\n          if (links.some(l => l.getAttribute('href') === path)) return path;\n          if (path === '' || path === '/') return '/';\n          return path;\n        }\n\n        setActive(currentHref());\n\n        links.forEach(l => {\n          l.addEventListener('click', () => {\n            setTimeout(() => setActive(l.getAttribute('href')), 80);\n          });\n        });\n\n        // Scroll spy: observer activ în banda de 15%–25% de sus a viewport-ului\n        // → butonul se aprinde când secțiunea intră în zona vizuală principală\n        const sections = document.querySelectorAll('section[id]');\n        if (!sections.length) return;\n\n        const obs = new IntersectionObserver((entries) => {\n          entries.forEach(entry => {\n            if (!entry.isIntersecting) return;\n            const id = entry.target.id;\n            const path = location.pathname.replace(/\\/$/, '') || '/';\n\n            if (path === '/') {\n              // Homepage: folosim harta secțiune → buton sidebar\n              const href = sectionToHref[id];\n              if (href) setActive(href);\n            } else {\n              // Subpagini: potrivire după path+#id\n              const anchorHref = path + '#' + id;\n              if (links.some(l => l.getAttribute('href') === anchorHref)) {\n                setActive(anchorHref);\n              }\n            }\n          });\n        }, {\n          rootMargin: '-15% 0px -75% 0px',\n          threshold: 0,\n        });\n\n        sections.forEach(s => obs.observe(s));\n      })();\n    </script> </body> </html>"], ['<html lang="ro" class="scroll-smooth"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#0c0f1f">', '<meta property="og:type"', '><meta property="og:title"', '><meta property="og:description"', ">", '<meta property="og:image"', '><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ro_RO"><meta property="og:site_name"', '><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><link rel="icon" type="image/svg+xml" href="/images/logo-fp-stage.svg"><script type="application/ld+json">', "</script>", "", "", "", '</head> <body class="page-shell"> <a href="#continut" class="skip-link">Sari la conținut</a> ', " ", ' <div class="layout-content-shell"> <aside class="left-side-menu" aria-label="Acces rapid"> ', " ", ' </aside> <main id="continut" class="flex-1 min-w-0 pt-40 sm:pt-44"> ', " </main> </div> ", " <script>\n      (() => {\n        const root = document.documentElement;\n        let ticking = false;\n\n        const updateScrollProgress = () => {\n          const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;\n          const progress = scrollableHeight > 0 ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;\n          root.style.setProperty('--scroll-progress', progress.toFixed(4));\n        };\n\n        const onScroll = () => {\n          if (ticking) return;\n          ticking = true;\n          requestAnimationFrame(() => {\n            updateScrollProgress();\n            ticking = false;\n          });\n        };\n\n        window.addEventListener('scroll', onScroll, { passive: true });\n        window.addEventListener('resize', updateScrollProgress);\n        updateScrollProgress();\n      })();\n    </script> <script>\n      // Scroll spy sidebar — activare buton la derulare\n      (() => {\n        const menu = document.querySelector('.left-side-menu');\n        if (!menu) return;\n        const links = Array.from(menu.querySelectorAll('.left-side-link'));\n\n        // Mapare explicită: id secțiune din homepage → href buton sidebar\n        const sectionToHref = {\n          'acasa':   '/',\n          'video':   '/galerie-video',\n          'membri':  '/#membri',\n          'galerie': '/galerie-foto',\n        };\n\n        function setActive(href) {\n          menu.classList.remove('has-active');\n          links.forEach(l => l.classList.remove('is-active'));\n          const match = links.find(l => l.getAttribute('href') === href);\n          if (match) {\n            match.classList.add('is-active');\n            menu.classList.add('has-active');\n          }\n        }\n\n        // Potrivire inițială după pathname\n        function currentHref() {\n          const path = location.pathname.replace(/\\\\/$/, '') || '/';\n          const hash = location.hash;\n          const full = path + hash;\n          if (links.some(l => l.getAttribute('href') === full)) return full;\n          if (links.some(l => l.getAttribute('href') === path)) return path;\n          if (path === '' || path === '/') return '/';\n          return path;\n        }\n\n        setActive(currentHref());\n\n        links.forEach(l => {\n          l.addEventListener('click', () => {\n            setTimeout(() => setActive(l.getAttribute('href')), 80);\n          });\n        });\n\n        // Scroll spy: observer activ în banda de 15%–25% de sus a viewport-ului\n        // → butonul se aprinde când secțiunea intră în zona vizuală principală\n        const sections = document.querySelectorAll('section[id]');\n        if (!sections.length) return;\n\n        const obs = new IntersectionObserver((entries) => {\n          entries.forEach(entry => {\n            if (!entry.isIntersecting) return;\n            const id = entry.target.id;\n            const path = location.pathname.replace(/\\\\/$/, '') || '/';\n\n            if (path === '/') {\n              // Homepage: folosim harta secțiune → buton sidebar\n              const href = sectionToHref[id];\n              if (href) setActive(href);\n            } else {\n              // Subpagini: potrivire după path+#id\n              const anchorHref = path + '#' + id;\n              if (links.some(l => l.getAttribute('href') === anchorHref)) {\n                setActive(anchorHref);\n              }\n            }\n          });\n        }, {\n          rootMargin: '-15% 0px -75% 0px',\n          threshold: 0,\n        });\n\n        sections.forEach(s => obs.observe(s));\n      })();\n    </script> </body> </html>"])), title, addAttribute(description, "content"), canonical && renderTemplate`<link rel="canonical"${addAttribute(canonical, "href")}>`, addAttribute(ogType, "content"), addAttribute(title, "content"), addAttribute(description, "content"), canonical && renderTemplate`<meta property="og:url"${addAttribute(canonical, "content")}>`, addAttribute(ogImage, "content"), addAttribute(siteContent.brand.name, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), unescapeHTML(JSON.stringify(jsonLd)), renderSlot($$result, $$slots["head"]), ga4Id, ga4Id, renderHead(), renderComponent($$result, "SkyBackground", $$SkyBackground, {}), renderComponent($$result, "Header", $$Header, {}), sideMenuTopItems.map((item) => renderTemplate`<a${addAttribute(item.href, "href")}${addAttribute(`left-side-link nav-btn-${item.color}`, "class")} data-nav-link>${item.label}</a>`), sideMenuBottomItems.map((item) => renderTemplate`<a${addAttribute(item.href, "href")}${addAttribute(`left-side-link nav-btn-${item.color}`, "class")} data-nav-link>${item.label}</a>`), renderSlot($$result, $$slots["default"]), renderComponent($$result, "Footer", $$Footer, {}));
}, "D:/landing-ul meu/src/layouts/BaseLayout.astro", void 0);

export { $$BaseLayout as $, siteContent as s };
