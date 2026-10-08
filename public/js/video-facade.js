/**
 * Runtime VideoFacade — încărcat LA CERERE de loader-ul `is:inline` din
 * `src/components/VideoFacade.astro` prin `import('/js/video-facade.js')`.
 *
 * Trăiește în `public/js/` (URL stabil, fără hash) tocmai ca HTML-ul să nu mai
 * aibă niciun lanț critic de module `/_astro/*` (PageSpeed: „Avoid chaining
 * critical requests"). În `dist/client` fișierul este minificat și pre-comprimat
 * de `scripts/compress.mjs`; sursa de aici rămâne lizibilă.
 *
 * Testat de `scripts/video-views.test.cjs` (funcțiile runtime — bindFacades,
 * activate, trackView, loadViews, resetFacade — rămân aici, la nivel de modul).
 */
const ALLOWED_HOSTS = [
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'www.youtube.com',
  'youtube.com',
  'player.vimeo.com',
  'iframe.videodelivery.net',
  'iframe.cloudflarestream.com',
  'customer-*.cloudflarestream.com',
];

function isAllowedHost(host) {
  return ALLOWED_HOSTS.some((pattern) => {
    if (!pattern.includes('*')) return host === pattern;
    const [prefix, suffix] = pattern.split('*');
    return host.startsWith(prefix) && host.endsWith(suffix);
  });
}

function buildAutoplayUrl(raw) {
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) return null;
    url.searchParams.set('autoplay', '1');
    return url.toString();
  } catch {
    return null;
  }
}

const VIEWS_ENDPOINT = '/api/track-video/';
const viewsFormatter = new Intl.NumberFormat('ro-RO');
const trackedVideos = new Set();
const latestViews = new Map();
const playerCleanup = new WeakMap();
const videoWindow = window;
let streamSdk;
let youtubeSdk;

function loadPlayerSdk(youtube) {
  if (youtube ? videoWindow.YT?.Player : videoWindow.Stream) return Promise.resolve();
  const existing = youtube ? youtubeSdk : streamSdk;
  if (existing) return existing;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Video SDK timeout.')), 15000);
    const ready = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    if (youtube) {
      const previous = videoWindow.onYouTubeIframeAPIReady;
      videoWindow.onYouTubeIframeAPIReady = () => {
        try {
          previous?.();
        } finally {
          ready();
        }
      };
    } else {
      script.onload = ready;
    }
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Video SDK unavailable.'));
    };
    script.src = youtube
      ? 'https://www.youtube.com/iframe_api'
      : 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
    document.head.append(script);
  });
  if (youtube) youtubeSdk = promise;
  else streamSdk = promise;
  void promise.catch(() => {
    if (youtube) youtubeSdk = undefined;
    else streamSdk = undefined;
  });
  return promise;
}

const coverNodes = new WeakMap();

function renderViews(facade, views) {
  facade.dataset.videoViews = String(views);
  const badge = facade.querySelector('[data-video-views]');
  if (!badge) return;
  const count = badge.querySelector('[data-video-views-count]');
  if (count) count.textContent = viewsFormatter.format(views);
  badge.hidden = false;
  badge.setAttribute('aria-label', String(views) + ' vizualizări');
}

async function loadViews(facades) {
  const ids = [];
  facades.forEach((facade) => {
    const id = facade.dataset.videoId;
    if (id) ids.push(id);
  });
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return;
  try {
    const res = await fetch('/api/views/?ids=' + encodeURIComponent(uniqueIds.join(',')), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return;
    const data = await res.json();
    facades.forEach((facade) => {
      const id = facade.dataset.videoId || '';
      const loaded = data.views?.[id];
      const valid = typeof loaded === 'number' && Number.isSafeInteger(loaded) && loaded >= 0;
      const value = valid ? Math.max(latestViews.get(id) ?? 0, loaded) : latestViews.get(id);
      if (typeof value === 'number') renderViews(facade, value);
    });
  } catch {
    // Contorul e decorativ — eșecul rețelei nu afectează redarea.
  }
}

async function trackView(facade) {
  const videoId = facade.dataset.videoId;
  if (!videoId || trackedVideos.has(videoId)) return;
  trackedVideos.add(videoId);
  try {
    const res = await fetch(VIEWS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId }),
      keepalive: true,
    });
    if (res.status === 429) return;
    if (!res.ok) throw new Error('Video tracking failed.');
    const data = await res.json();
    const views = data.views_count;
    if (typeof views !== 'number' || !Number.isSafeInteger(views) || views < 0) {
      throw new Error('Video count invalid.');
    }
    latestViews.set(videoId, views);
    document.querySelectorAll('[data-video-facade]').forEach((f) => {
      if (f.dataset.videoId === videoId) renderViews(f, views);
    });
  } catch {
    trackedVideos.delete(videoId);
  }
}

function resetFacade(facade) {
  const nodes = coverNodes.get(facade);
  if (!nodes) return;
  playerCleanup.get(facade)?.();
  playerCleanup.delete(facade);
  facade.replaceChildren(...nodes);
  coverNodes.delete(facade);
  delete facade.dataset.videoActive;
  facade.classList.add('cursor-pointer', 'group');
  facade.setAttribute('role', 'button');
  facade.setAttribute('tabindex', '0');
  facade.setAttribute('aria-label', 'Redă videoclipul: ' + (facade.dataset.videoTitle || 'Videoclip'));
  if (facade.dataset.videoViews) renderViews(facade, Number(facade.dataset.videoViews));
}

function stopOthers(current) {
  document.querySelectorAll('[data-video-facade]').forEach((facade) => {
    if (facade === current) return;
    if (facade.dataset.videoActive === 'true') resetFacade(facade);
    if (facade.dataset.videoPending === 'true') {
      delete facade.dataset.videoPending;
      toggleConsentPanel(facade, false);
    }
  });
}

async function activate(facade) {
  if (facade.dataset.videoActive === 'true') return;
  const src = buildAutoplayUrl(facade.dataset.videoUrl || '');
  if (!src) return;

  stopOthers(facade);
  delete facade.dataset.videoPending;
  toggleConsentPanel(facade, false);
  const nodes = Array.from(facade.childNodes);
  coverNodes.set(facade, nodes);
  facade.dataset.videoActive = 'true';
  facade.classList.remove('cursor-pointer', 'group');
  facade.removeAttribute('role');
  facade.removeAttribute('tabindex');
  facade.removeAttribute('aria-label');

  const iframe = document.createElement('iframe');
  const url = new URL(src);
  const youtube = url.hostname.includes('youtube');
  const cloudflare = url.hostname.endsWith('.cloudflarestream.com') || url.hostname === 'iframe.videodelivery.net';
  if (youtube) {
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', window.location.origin);
  }
  iframe.title = facade.dataset.videoTitle || 'Videoclip';
  iframe.loading = 'lazy';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.className = 'absolute inset-0 h-full w-full border-0';

  try {
    if (youtube || cloudflare) await loadPlayerSdk(youtube);
  } catch {
    // SDK-ul nu este critic pentru redarea statică a fațadei.
  }
  if (!facade.isConnected || coverNodes.get(facade) !== nodes) return;
  const badge = facade.querySelector('[data-video-views]')?.cloneNode(true);
  if (badge) {
    badge.classList.add('absolute', 'bottom-3', 'right-3', 'z-10', 'pointer-events-none');
  }
  iframe.src = url.toString();
  facade.replaceChildren(iframe, ...(badge ? [badge] : []));
  const onPlay = () => {
    void trackView(facade);
  };
  if (cloudflare && videoWindow.Stream) {
    const player = videoWindow.Stream(iframe);
    player.addEventListener('play', onPlay);
    playerCleanup.set(facade, () => player.removeEventListener('play', onPlay));
  } else if (youtube && videoWindow.YT?.Player) {
    const player = new videoWindow.YT.Player(iframe, {
      events: {
        onStateChange: (event) => {
          if (event.data === 1) onPlay();
        },
      },
    });
    playerCleanup.set(facade, () => player.destroy());
  }
  iframe.focus();
}

function hasConsent() {
  try {
    return localStorage.getItem('cookie_consent') === 'granted';
  } catch {
    return false;
  }
}

function toggleConsentPanel(facade, show) {
  const panel = facade.querySelector('[data-video-consent]');
  if (!panel) return;
  panel.hidden = !show;
  panel.classList.toggle('hidden', !show);
  panel.classList.toggle('flex', show);
  if (show) panel.querySelector('[data-video-consent-accept]')?.focus();
}

function requestPlay(facade) {
  if (facade.dataset.videoActive === 'true') return;
  if (hasConsent()) {
    activate(facade);
    return;
  }
  stopOthers(facade);
  facade.dataset.videoPending = 'true';
  toggleConsentPanel(facade, true);
}

function grantConsent(facade) {
  try {
    localStorage.setItem('cookie_consent', 'granted');
  } catch {
    // localStorage indisponibil — consimțământul rămâne valabil doar pentru această redare
  }
  window.dispatchEvent(new CustomEvent('cookie:granted'));
  activate(facade);
}

function setInfoPanel(facade, open) {
  const panel = facade.querySelector('[data-video-info-panel]');
  const trigger = facade.querySelector('[data-video-info-open]');
  if (!panel || !trigger) return;
  panel.inert = !open;
  panel.classList.toggle('opacity-0', !open);
  panel.classList.toggle('pointer-events-none', !open);
  panel.classList.toggle('opacity-100', open);
  trigger.setAttribute('aria-expanded', String(open));
  if (open) panel.querySelector('[data-video-info-close]')?.focus();
  else trigger.focus();
}

function bindInfo(facade) {
  const trigger = facade.querySelector('[data-video-info-open]');
  const panel = facade.querySelector('[data-video-info-panel]');
  if (!trigger || !panel) return;

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setInfoPanel(facade, true);
  });

  panel.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target?.closest('[data-video-info-close]')) {
      setInfoPanel(facade, false);
    }
  });

  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') setInfoPanel(facade, false);
  });
}

function bindFacades() {
  document.querySelectorAll('[data-video-facade]').forEach((facade) => {
    if (facade.dataset.videoBound === 'true') return;
    facade.dataset.videoBound = 'true';
    bindInfo(facade);

    facade.addEventListener('click', (event) => {
      const target = event.target;
      if (target?.closest('[data-video-consent]')) {
        if (target.closest('[data-video-consent-accept]')) {
          void loadViews([facade]);
          grantConsent(facade);
        }
        return;
      }
      if (facade.dataset.videoActive === 'true') return;
      void loadViews([facade]);
      requestPlay(facade);
    });

    facade.addEventListener('keydown', (event) => {
      if (event.target !== facade) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (facade.dataset.videoActive === 'true') return;
        void loadViews([facade]);
        requestPlay(facade);
      }
    });
  });
}

function scheduleFacadeBinding() {
  const facades = Array.from(document.querySelectorAll('[data-video-facade]'));
  if (!facades.length) return;

  const runWhenReady = () => {
    if (facades.some((facade) => facade.dataset.videoBound === 'true')) return;
    bindFacades();
  };

  if (!('IntersectionObserver' in window)) {
    runWhenReady();
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
      obs.disconnect();
      runWhenReady();
    }
  }, {
    rootMargin: '200px 0px',
    threshold: [0, 0.01],
  });

  facades.forEach((facade) => observer.observe(facade));

  const idleCallback = 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb, _options) => window.setTimeout(cb, 1200);

  const idleId = idleCallback(() => {
    observer.disconnect();
    runWhenReady();
  }, { timeout: 1200 });

  if (typeof idleId === 'number') {
    window.setTimeout(() => {
      if (facades.some((facade) => facade.dataset.videoBound !== 'true')) {
        observer.disconnect();
        runWhenReady();
      }
    }, 1800);
  }
}

export function initVideoFacades() {
  if (typeof window === 'undefined') return;

  const win = window;
  if (win.__fp_video_facade_runtime_initialized__) return;
  win.__fp_video_facade_runtime_initialized__ = true;

  window.addEventListener('cookie:granted', () => {
    document.querySelectorAll('[data-video-facade]').forEach((facade) => {
      if (facade.dataset.videoPending === 'true') {
        const src = buildAutoplayUrl(facade.dataset.videoUrl || '');
        if (src) {
          void activate(facade);
        }
      }
    });
  });

  scheduleFacadeBinding();
  document.addEventListener('astro:page-load', scheduleFacadeBinding);
  document.addEventListener('astro:before-swap', () => {
    document.querySelectorAll('[data-video-facade]').forEach(resetFacade);
  });
}
