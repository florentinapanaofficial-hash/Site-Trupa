import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_DqZkOwos.mjs';
import { manifest } from './manifest_D0pwgjC_.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/aparitii-tv.astro.mjs');
const _page2 = () => import('./pages/api/comentarii.astro.mjs');
const _page3 = () => import('./pages/api/upload-photo.astro.mjs');
const _page4 = () => import('./pages/blog/_slug_.astro.mjs');
const _page5 = () => import('./pages/blog.astro.mjs');
const _page6 = () => import('./pages/colaboratori/saxofon.astro.mjs');
const _page7 = () => import('./pages/colaboratori/tambal.astro.mjs');
const _page8 = () => import('./pages/comunitatea-noastra.astro.mjs');
const _page9 = () => import('./pages/contact.astro.mjs');
const _page10 = () => import('./pages/despre.astro.mjs');
const _page11 = () => import('./pages/galerie-foto.astro.mjs');
const _page12 = () => import('./pages/galerie-video.astro.mjs');
const _page13 = () => import('./pages/momente-cu-mirii.astro.mjs');
const _page14 = () => import('./pages/video/_slug_.astro.mjs');
const _page15 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/node.js", _page0],
    ["src/pages/aparitii-tv.astro", _page1],
    ["src/pages/api/comentarii.ts", _page2],
    ["src/pages/api/upload-photo.ts", _page3],
    ["src/pages/blog/[slug].astro", _page4],
    ["src/pages/blog/index.astro", _page5],
    ["src/pages/colaboratori/saxofon.astro", _page6],
    ["src/pages/colaboratori/tambal.astro", _page7],
    ["src/pages/comunitatea-noastra.astro", _page8],
    ["src/pages/contact.astro", _page9],
    ["src/pages/despre.astro", _page10],
    ["src/pages/galerie-foto.astro", _page11],
    ["src/pages/galerie-video.astro", _page12],
    ["src/pages/momente-cu-mirii.astro", _page13],
    ["src/pages/video/[slug].astro", _page14],
    ["src/pages/index.astro", _page15]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///D:/landing-ul%20meu/dist/client/",
    "server": "file:///D:/landing-ul%20meu/dist/server/",
    "host": false,
    "port": 4321,
    "assets": "_astro"
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
{
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };
