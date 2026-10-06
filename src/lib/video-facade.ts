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

type StreamPlayer = {
  addEventListener: (event: string, listener: () => void) => void;
  removeEventListener: (event: string, listener: () => void) => void;
};

type YoutubePlayer = { destroy: () => void };

type VideoWindow = Window & {
  Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  YT?: {
    Player: new (iframe: HTMLIFrameElement, options: {
      events: { onStateChange: (event: { data: number }) => void };
    }) => YoutubePlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
};

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.some((pattern) => {
    if (!pattern.includes('*')) return host === pattern;
    const [prefix, suffix] = pattern.split('*');
    return host.startsWith(prefix) && host.endsWith(suffix);
  });
}

function buildAutoplayUrl(raw: string): string | null {
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
const trackedVideos = new Set<string>();
const latestViews = new Map<string, number>();
const playerCleanup = new WeakMap<HTMLElement, () => void>();
const videoWindow = window as VideoWindow;
let streamSdk: Promise<void> | undefined;
let youtubeSdk: Promise<void> | undefined;

function loadPlayerSdk(youtube: boolean): Promise<void> {
  if (youtube ? videoWindow.YT?.Player : videoWindow.Stream) return Promise.resolve();
  const existing = youtube ? youtubeSdk : streamSdk;
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
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

const coverNodes = new WeakMap<HTMLElement, Node[]>();

function renderViews(facade: HTMLElement, views: number): void {
  facade.dataset.videoViews = String(views);
  const badge = facade.querySelector<HTMLElement>('[data-video-views]');
  if (!badge) return;
  const count = badge.querySelector<HTMLElement>('[data-video-views-count]');
  if (count) count.textContent = viewsFormatter.format(views);
  badge.hidden = false;
  badge.setAttribute('aria-label', String(views) + ' vizualizări');
}

async function loadViews(facades: HTMLElement[]): Promise<void> {
  const ids: string[] = [];
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
    const data = (await res.json()) as { views?: Record<string, number> };
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

async function trackView(facade: HTMLElement): Promise<void> {
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
    const data = (await res.json()) as { views_count?: number };
    const views = data.views_count;
    if (typeof views !== 'number' || !Number.isSafeInteger(views) || views < 0) {
      throw new Error('Video count invalid.');
    }
    latestViews.set(videoId, views);
    document.querySelectorAll<HTMLElement>('[data-video-facade]').forEach((f) => {
      if (f.dataset.videoId === videoId) renderViews(f, views);
    });
  } catch {
    trackedVideos.delete(videoId);
  }
}

function resetFacade(facade: HTMLElement): void {
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

function stopOthers(current: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('[data-video-facade]').forEach((facade) => {
    if (facade === current) return;
    if (facade.dataset.videoActive === 'true') resetFacade(facade);
    if (facade.dataset.videoPending === 'true') {
      delete facade.dataset.videoPending;
      toggleConsentPanel(facade, false);
    }
  });
}

async function activate(facade: HTMLElement): Promise<void> {
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
  const badge = facade.querySelector<HTMLElement>('[data-video-views]')?.cloneNode(true) as HTMLElement | undefined;
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
        onStateChange: (event: { data: number }) => {
          if (event.data === 1) onPlay();
        },
      },
    });
    playerCleanup.set(facade, () => player.destroy());
  }
  iframe.focus();
}

function hasConsent(): boolean {
  try {
    return localStorage.getItem('cookie_consent') === 'granted';
  } catch {
    return false;
  }
}

function toggleConsentPanel(facade: HTMLElement, show: boolean): void {
  const panel = facade.querySelector<HTMLElement>('[data-video-consent]');
  if (!panel) return;
  panel.hidden = !show;
  panel.classList.toggle('hidden', !show);
  panel.classList.toggle('flex', show);
  if (show) panel.querySelector<HTMLButtonElement>('[data-video-consent-accept]')?.focus();
}

function requestPlay(facade: HTMLElement): void {
  if (facade.dataset.videoActive === 'true') return;
  if (hasConsent()) {
    activate(facade);
    return;
  }
  stopOthers(facade);
  facade.dataset.videoPending = 'true';
  toggleConsentPanel(facade, true);
}

function grantConsent(facade: HTMLElement): void {
  try {
    localStorage.setItem('cookie_consent', 'granted');
  } catch {
    // localStorage indisponibil — consimțământul rămâne valabil doar pentru această redare
  }
  window.dispatchEvent(new CustomEvent('cookie:granted'));
  activate(facade);
}

function setInfoPanel(facade: HTMLElement, open: boolean): void {
  const panel = facade.querySelector<HTMLElement>('[data-video-info-panel]');
  const trigger = facade.querySelector<HTMLButtonElement>('[data-video-info-open]');
  if (!panel || !trigger) return;
  panel.inert = !open;
  panel.classList.toggle('opacity-0', !open);
  panel.classList.toggle('pointer-events-none', !open);
  panel.classList.toggle('opacity-100', open);
  trigger.setAttribute('aria-expanded', String(open));
  if (open) panel.querySelector<HTMLButtonElement>('[data-video-info-close]')?.focus();
  else trigger.focus();
}

function bindInfo(facade: HTMLElement): void {
  const trigger = facade.querySelector<HTMLButtonElement>('[data-video-info-open]');
  const panel = facade.querySelector<HTMLElement>('[data-video-info-panel]');
  if (!trigger || !panel) return;

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setInfoPanel(facade, true);
  });

  panel.addEventListener('click', (event) => {
    event.stopPropagation();
    if ((event.target as HTMLElement | null)?.closest('[data-video-info-close]')) {
      setInfoPanel(facade, false);
    }
  });

  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') setInfoPanel(facade, false);
  });
}

function bindFacades(): void {
  document.querySelectorAll<HTMLElement>('[data-video-facade]').forEach((facade) => {
    if (facade.dataset.videoBound === 'true') return;
    facade.dataset.videoBound = 'true';
    bindInfo(facade);

    facade.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
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

function scheduleFacadeBinding(): void {
  const facades = Array.from(document.querySelectorAll<HTMLElement>('[data-video-facade]'));
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
    : (cb: IdleRequestCallback | (() => void), _timeout?: number) => window.setTimeout(cb as () => void, 1200);

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

export function initVideoFacades(): void {
  if (typeof window === 'undefined') return;

  const win = window as Window & Record<string, unknown>;
  if (win.__fp_video_facade_runtime_initialized__) return;
  win.__fp_video_facade_runtime_initialized__ = true;

  window.addEventListener('cookie:granted', () => {
    document.querySelectorAll<HTMLElement>('[data-video-facade]').forEach((facade) => {
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
    document.querySelectorAll<HTMLElement>('[data-video-facade]').forEach(resetFacade);
  });
}

