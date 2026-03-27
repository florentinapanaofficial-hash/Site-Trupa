(() => {
    const menu = document.querySelector('.left-side-menu');
    if (!menu) return;
    const links = Array.from(menu.querySelectorAll('.left-side-link'));

    const sectionToHref = {
        'acasa': '/',
        'video': '/galerie-video',
        'galerie': '/galerie-foto',
        'membri': '/membri',
    };

    function setActive(href) {
        menu.classList.remove('has-active');
        links.forEach(l => l.classList.remove('is-active'));
        const match = links.find(l => l.getAttribute('href') === href);
        if (match) {
            match.classList.add('is-active');
            menu.classList.add('has-active');
        }
    }

    function currentHref() {
        const path = location.pathname.replace(/\/$/, '') || '/';
        const hash = location.hash;
        const full = path + hash;
        if (links.some(l => l.getAttribute('href') === full)) return full;
        if (links.some(l => l.getAttribute('href') === path)) return path;
        if (path === '' || path === '/') return '/';
        return path;
    }

    setActive(currentHref());

    links.forEach(l => {
        l.addEventListener('click', () => {
            setTimeout(() => setActive(l.getAttribute('href')), 80);
        });
    });

    const sections = Array.from(document.querySelectorAll('section[id]'));
    if (!sections.length) return;

    const visibleSet = new Set();
    let lastActiveId = '';

    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                visibleSet.add(entry.target.id);
            } else {
                visibleSet.delete(entry.target.id);
            }
        });

        if (!visibleSet.size) return;

        const topSection = sections.find(s => visibleSet.has(s.id));
        if (!topSection || topSection.id === lastActiveId) return;
        lastActiveId = topSection.id;

        const path = location.pathname.replace(/\/$/, '') || '/';
        if (path === '/') {
            const href = sectionToHref[topSection.id];
            if (href) setActive(href);
        } else {
            const anchorHref = path + '#' + topSection.id;
            if (links.some(l => l.getAttribute('href') === anchorHref)) {
                setActive(anchorHref);
            }
        }
    }, {
        rootMargin: '-8% 0px -45% 0px',
        threshold: 0,
    });

    sections.forEach(s => obs.observe(s));
})();
