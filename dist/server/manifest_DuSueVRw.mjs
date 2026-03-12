import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_BFOO6HV8.mjs';
import 'es-module-lexer';
import { o as decodeKey } from './chunks/astro/server_CJG6WAvb.mjs';
import 'clsx';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///D:/landing-ul%20meu/","adapterName":"@astrojs/node","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/node.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/comentarii","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/comentarii\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"comentarii","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/comentarii.ts","pathname":"/api/comentarii","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/upload-photo","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/upload-photo\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"upload-photo","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/upload-photo.ts","pathname":"/api/upload-photo","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.BhC5TKSL.js"}],"styles":[{"type":"external","src":"/_astro/comunitatea-noastra.BaMIWp5-.css"},{"type":"external","src":"/_astro/comunitatea-noastra.NO63Suav.css"}],"routeData":{"route":"/comunitatea-noastra","isIndex":false,"type":"page","pattern":"^\\/comunitatea-noastra\\/?$","segments":[[{"content":"comunitatea-noastra","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/comunitatea-noastra.astro","pathname":"/comunitatea-noastra","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.J90q8cGx.js"}],"styles":[{"type":"external","src":"/_astro/comunitatea-noastra.BaMIWp5-.css"},{"type":"inline","content":".gallery-stage-fade[data-astro-cid-j7pv25f6]{opacity:0;transform:translateY(12px);animation:galleryStageFadeIn .62s cubic-bezier(.22,1,.36,1) forwards}@keyframes galleryStageFadeIn{0%{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion: reduce){.gallery-stage-fade[data-astro-cid-j7pv25f6]{opacity:1;transform:none;animation:none}}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"site":"https://landing-ul-meu.example.com","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["D:/landing-ul meu/src/pages/comunitatea-noastra.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/index.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/video/[slug].astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/node@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/api/comentarii@_@ts":"pages/api/comentarii.astro.mjs","\u0000@astro-page:src/pages/api/upload-photo@_@ts":"pages/api/upload-photo.astro.mjs","\u0000@astro-page:src/pages/comunitatea-noastra@_@astro":"pages/comunitatea-noastra.astro.mjs","\u0000@astro-page:src/pages/video/[slug]@_@astro":"pages/video/_slug_.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","D:/landing-ul meu/node_modules/astro/dist/env/setup.js":"chunks/astro/env-setup_Cr6XTFvb.mjs","\u0000@astrojs-manifest":"manifest_DuSueVRw.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.BhC5TKSL.js","/astro/hoisted.js?q=1":"_astro/hoisted.J90q8cGx.js","/astro/hoisted.js?q=2":"_astro/hoisted.CQsoRzeO.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/comunitatea-noastra.BaMIWp5-.css","/_astro/comunitatea-noastra.NO63Suav.css","/robots.txt","/admin/config.yml","/admin/index.html","/images/cosmic-space-bg.svg","/images/logo-fp-stage.svg","/images/og-placeholder.png","/_astro/hoisted.BhC5TKSL.js","/_astro/hoisted.CQsoRzeO.js","/_astro/hoisted.J90q8cGx.js"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"JlcN/DspT8W/kG8Depj6T96XoMFgG+1cPjl5J6CiJkA=","experimentalEnvGetSecretEnabled":false});

export { manifest };
