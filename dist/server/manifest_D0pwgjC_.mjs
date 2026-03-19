import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_DhTkVPI4.mjs';
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

const manifest = deserializeManifest({"hrefRoot":"file:///D:/landing-ul%20meu/","adapterName":"@astrojs/node","routes":[{"file":"aparitii-tv/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/aparitii-tv","isIndex":false,"type":"page","pattern":"^\\/aparitii-tv\\/?$","segments":[[{"content":"aparitii-tv","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/aparitii-tv.astro","pathname":"/aparitii-tv","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"blog/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/blog","isIndex":true,"type":"page","pattern":"^\\/blog\\/?$","segments":[[{"content":"blog","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/blog/index.astro","pathname":"/blog","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"colaboratori/saxofon/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/colaboratori/saxofon","isIndex":false,"type":"page","pattern":"^\\/colaboratori\\/saxofon\\/?$","segments":[[{"content":"colaboratori","dynamic":false,"spread":false}],[{"content":"saxofon","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/colaboratori/saxofon.astro","pathname":"/colaboratori/saxofon","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"colaboratori/tambal/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/colaboratori/tambal","isIndex":false,"type":"page","pattern":"^\\/colaboratori\\/tambal\\/?$","segments":[[{"content":"colaboratori","dynamic":false,"spread":false}],[{"content":"tambal","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/colaboratori/tambal.astro","pathname":"/colaboratori/tambal","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"contact/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/contact","isIndex":false,"type":"page","pattern":"^\\/contact\\/?$","segments":[[{"content":"contact","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/contact.astro","pathname":"/contact","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"despre/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/despre","isIndex":false,"type":"page","pattern":"^\\/despre\\/?$","segments":[[{"content":"despre","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/despre.astro","pathname":"/despre","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"galerie-foto/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/galerie-foto","isIndex":false,"type":"page","pattern":"^\\/galerie-foto\\/?$","segments":[[{"content":"galerie-foto","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/galerie-foto.astro","pathname":"/galerie-foto","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"galerie-video/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/galerie-video","isIndex":false,"type":"page","pattern":"^\\/galerie-video\\/?$","segments":[[{"content":"galerie-video","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/galerie-video.astro","pathname":"/galerie-video","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/node.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/comentarii","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/comentarii\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"comentarii","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/comentarii.ts","pathname":"/api/comentarii","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/upload-photo","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/upload-photo\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"upload-photo","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/upload-photo.ts","pathname":"/api/upload-photo","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.69wAnwY6.js"}],"styles":[{"type":"external","src":"/_astro/aparitii-tv.2eKAit6g.css"},{"type":"inline","content":".back-btn[data-astro-cid-7a7bzblm]{display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:9999px;border:1.5px solid rgba(120,200,255,.35);background:#50b4ff12;text-decoration:none;transition:background .22s ease,border-color .22s ease,box-shadow .22s ease}.back-btn[data-astro-cid-7a7bzblm]:hover{background:#64c8ff26;border-color:#a0dcffa6;box-shadow:0 0 14px #64c8ff4d}.back-arrow[data-astro-cid-7a7bzblm]{color:transparent;stroke:url(#pearl-grad);animation:arrow-nudge 1.8s ease-in-out infinite;filter:drop-shadow(0 0 4px rgba(140,220,255,.55))}.back-btn[data-astro-cid-7a7bzblm]:hover .back-arrow[data-astro-cid-7a7bzblm]{animation:none;filter:drop-shadow(0 0 7px rgba(180,235,255,.8))}@keyframes arrow-nudge{0%,to{transform:translate(0)}40%{transform:translate(-5px)}65%{transform:translate(-2px)}}\n"},{"type":"external","src":"/_astro/comunitatea-noastra.CmQmaGxi.css"}],"routeData":{"route":"/comunitatea-noastra","isIndex":false,"type":"page","pattern":"^\\/comunitatea-noastra\\/?$","segments":[[{"content":"comunitatea-noastra","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/comunitatea-noastra.astro","pathname":"/comunitatea-noastra","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.hHsxJZdl.js"}],"styles":[{"type":"external","src":"/_astro/aparitii-tv.2eKAit6g.css"},{"type":"inline","content":".back-btn[data-astro-cid-7a7bzblm]{display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:9999px;border:1.5px solid rgba(120,200,255,.35);background:#50b4ff12;text-decoration:none;transition:background .22s ease,border-color .22s ease,box-shadow .22s ease}.back-btn[data-astro-cid-7a7bzblm]:hover{background:#64c8ff26;border-color:#a0dcffa6;box-shadow:0 0 14px #64c8ff4d}.back-arrow[data-astro-cid-7a7bzblm]{color:transparent;stroke:url(#pearl-grad);animation:arrow-nudge 1.8s ease-in-out infinite;filter:drop-shadow(0 0 4px rgba(140,220,255,.55))}.back-btn[data-astro-cid-7a7bzblm]:hover .back-arrow[data-astro-cid-7a7bzblm]{animation:none;filter:drop-shadow(0 0 7px rgba(180,235,255,.8))}@keyframes arrow-nudge{0%,to{transform:translate(0)}40%{transform:translate(-5px)}65%{transform:translate(-2px)}}\n"},{"type":"external","src":"/_astro/momente-cu-mirii.Cfyhjq6o.css"}],"routeData":{"route":"/momente-cu-mirii","isIndex":false,"type":"page","pattern":"^\\/momente-cu-mirii\\/?$","segments":[[{"content":"momente-cu-mirii","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/momente-cu-mirii.astro","pathname":"/momente-cu-mirii","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"site":"https://florentinapanaofficial.ro","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["D:/landing-ul meu/src/pages/aparitii-tv.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/blog/[slug].astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/blog/index.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/colaboratori/saxofon.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/colaboratori/tambal.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/comunitatea-noastra.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/contact.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/despre.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/galerie-foto.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/galerie-video.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/index.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/momente-cu-mirii.astro",{"propagation":"none","containsHead":true}],["D:/landing-ul meu/src/pages/video/[slug].astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/node@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/aparitii-tv@_@astro":"pages/aparitii-tv.astro.mjs","\u0000@astro-page:src/pages/api/comentarii@_@ts":"pages/api/comentarii.astro.mjs","\u0000@astro-page:src/pages/api/upload-photo@_@ts":"pages/api/upload-photo.astro.mjs","\u0000@astro-page:src/pages/blog/[slug]@_@astro":"pages/blog/_slug_.astro.mjs","\u0000@astro-page:src/pages/blog/index@_@astro":"pages/blog.astro.mjs","\u0000@astro-page:src/pages/colaboratori/saxofon@_@astro":"pages/colaboratori/saxofon.astro.mjs","\u0000@astro-page:src/pages/colaboratori/tambal@_@astro":"pages/colaboratori/tambal.astro.mjs","\u0000@astro-page:src/pages/comunitatea-noastra@_@astro":"pages/comunitatea-noastra.astro.mjs","\u0000@astro-page:src/pages/contact@_@astro":"pages/contact.astro.mjs","\u0000@astro-page:src/pages/despre@_@astro":"pages/despre.astro.mjs","\u0000@astro-page:src/pages/galerie-foto@_@astro":"pages/galerie-foto.astro.mjs","\u0000@astro-page:src/pages/galerie-video@_@astro":"pages/galerie-video.astro.mjs","\u0000@astro-page:src/pages/momente-cu-mirii@_@astro":"pages/momente-cu-mirii.astro.mjs","\u0000@astro-page:src/pages/video/[slug]@_@astro":"pages/video/_slug_.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","D:/landing-ul meu/node_modules/astro/dist/env/setup.js":"chunks/astro/env-setup_Cr6XTFvb.mjs","\u0000@astrojs-manifest":"manifest_D0pwgjC_.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.69wAnwY6.js","/astro/hoisted.js?q=1":"_astro/hoisted.BBk9kEq2.js","/astro/hoisted.js?q=2":"_astro/hoisted.L3c0VS30.js","/astro/hoisted.js?q=3":"_astro/hoisted.hHsxJZdl.js","/astro/hoisted.js?q=4":"_astro/hoisted.D9saNnlR.js","/astro/hoisted.js?q=5":"_astro/hoisted.D9u68yqK.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/aparitii-tv.2eKAit6g.css","/_astro/_slug_.BheKF--k.css","/_astro/comunitatea-noastra.CmQmaGxi.css","/_astro/despre.DQQOifHd.css","/_astro/momente-cu-mirii.Cfyhjq6o.css","/_astro/index.DjInMmCk.css","/robots.txt","/admin/config.yml","/admin/index.html","/_astro/hoisted.69wAnwY6.js","/_astro/hoisted.BBk9kEq2.js","/_astro/hoisted.D9saNnlR.js","/_astro/hoisted.D9u68yqK.js","/_astro/hoisted.hHsxJZdl.js","/_astro/hoisted.L3c0VS30.js","/images/cosmic-space-bg.svg","/images/logo-fp-stage.svg","/images/og-placeholder.png","/images/png-clipart-purple-petaled-flower-illustration-purple-rose-flower-purple-roses-herbaceous-plant-flower-arranging.png","/aparitii-tv/index.html","/blog/index.html","/colaboratori/saxofon/index.html","/colaboratori/tambal/index.html","/contact/index.html","/despre/index.html","/galerie-foto/index.html","/galerie-video/index.html","/index.html"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"KOnwzd9p4pcat9S2vk7bl5VJy/ZDGlnJrnEIp7jU3Bo=","experimentalEnvGetSecretEnabled":false});

export { manifest };
