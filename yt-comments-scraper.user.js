// ==UserScript==
// @name         YT Comments Scraper v1.8.2 (Michał Marini Edition)
// @namespace    http://tampermonkey.net/
// @version      1.8.2
// @description  Pobiera komentarze z YouTube (z poprawionym pobieraniem odpowiedzi i dat)
// @author       Michał Marini
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    console.log('[YT Scraper] >>> SKRYPT URUCHOMIONY <<<');

    const C = {
        bg: '#FFFDF5', ink: '#000000', accent: '#FF6B6B',
        yellow: '#FFD93D', white: '#FFFFFF',
        font: "'Space Grotesk', Arial, sans-serif",
        border: '4px solid #000',
        shadowSm: '4px 4px 0px 0px #000',
        shadowMd: '8px 8px 0px 0px #000',
        shadowLg: '12px 12px 0px 0px #000',
    };

    const CONFIG = {
        scrollPause: 1800,
        maxScrollRetries: 6,
        linkedInUrl: 'https://www.linkedin.com/in/michal-marini/'
    };

    if (!document.getElementById('yts-font')) {
        const link = document.createElement('link');
        link.id = 'yts-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&display=swap';
        document.head.appendChild(link);
    }

    let bubble = null, panel = null, statusEl = null, overlay = null, isOpen = false;

    function el(tag, styles, text) {
        const e = document.createElement(tag);
        if (styles) Object.assign(e.style, styles);
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function addPush(btn, sh) {
        btn.addEventListener('mousedown', () => { btn.style.transform = 'translate(3px,3px)'; btn.style.boxShadow = 'none'; });
        btn.addEventListener('mouseup', () => { btn.style.transform = 'translate(0,0)'; btn.style.boxShadow = sh; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)'; btn.style.boxShadow = sh; });
    }

    function showOverlay() {
        if (overlay) return;
        overlay = el('div', {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)', zIndex: '2147483640'
        });
        overlay.addEventListener('click', togglePanel);
        document.body.appendChild(overlay);
    }

    function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }

    function anonymizeAuthor(author) {
        if (!author || author === 'Nieznany') return 'Użytkownik';
        const t = author.trim();
        if (t.startsWith('@')) {
            const n = t.substring(1);
            return n.length <= 2 ? '@**' : '@' + n[0] + '*'.repeat(Math.min(n.length-2,6)) + n[n.length-1];
        }
        if (t.includes(' ')) {
            const p = t.split(' ');
            const f = p[0], l = p[p.length-1];
            return (f[0] + '*'.repeat(Math.min(f.length-1,4))) + ' ' + (l[0] + '*'.repeat(Math.min(l.length-1,4)));
        }
        return t.length <= 2 ? t[0]+'*' : t[0] + '*'.repeat(Math.min(t.length-2,6)) + t[t.length-1];
    }

    function buildUI() {
        if (document.getElementById('yts-bubble')) return;

        bubble = el('div', {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
            width: '60px', height: '60px', background: C.accent, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', cursor: 'pointer', userSelect: 'none',
            border: C.border, boxShadow: C.shadowMd, fontFamily: C.font, fontWeight: '900'
        });
        bubble.id = 'yts-bubble';
        bubble.textContent = '📥';
        addPush(bubble, C.shadowMd);
        bubble.addEventListener('click', togglePanel);

        panel = el('div', {
            position: 'fixed', bottom: '92px', right: '20px', zIndex: '2147483647',
            width: '320px', background: C.bg, border: C.border,
            boxShadow: C.shadowLg, fontFamily: C.font, display: 'none'
        });

        const header = el('div', { background: C.ink, padding: '12px 16px', borderBottom: C.border, display: 'flex', alignItems: 'center', gap: '10px' });
        header.appendChild(el('span', { fontSize: '20px' }, '📥'));
        header.appendChild(el('span', { color: C.white, fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }, 'YT Comment Scraper'));
        panel.appendChild(header);

        const body = el('div', { padding: '16px' });
        body.appendChild(el('div', { color: C.ink, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }, 'Liczba komentarzy'));

        const modeRow = el('div', { display: 'flex', gap: '8px', marginBottom: '14px' });
        const btnAll = el('button', {
            flex: '1', padding: '10px 8px', border: C.border, background: C.accent, color: C.ink,
            fontSize: '13px', fontWeight: '900', fontFamily: C.font, textTransform: 'uppercase',
            cursor: 'pointer', boxShadow: C.shadowSm
        }, '🔥 WSZYSTKIE');
        addPush(btnAll, C.shadowSm);

        const btnCustom = el('button', {
            flex: '1', padding: '10px 8px', border: C.border, background: C.white, color: C.ink,
            fontSize: '13px', fontWeight: '900', fontFamily: C.font, textTransform: 'uppercase',
            cursor: 'pointer', boxShadow: C.shadowSm
        }, '✏️ LICZBA');
        addPush(btnCustom, C.shadowSm);

        modeRow.appendChild(btnAll);
        modeRow.appendChild(btnCustom);
        body.appendChild(modeRow);

        const inputRow = el('div', { marginBottom: '14px', display: 'none' });
        const input = document.createElement('input');
        input.type = 'number'; input.min = '1'; input.value = '100';
        Object.assign(input.style, {
            width: '100%', padding: '12px', background: C.white, border: C.border,
            color: C.ink, boxShadow: C.shadowSm, fontSize: '16px', fontWeight: '700',
            fontFamily: C.font, boxSizing: 'border-box', outline: 'none'
        });
        inputRow.appendChild(input);

        const quickRow = el('div', { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' });
        [50, 100, 250, 500, 1000].forEach(val => {
            const qb = el('button', {
                padding: '6px 12px', background: C.bg, border: '3px solid #000', color: C.ink,
                fontSize: '12px', fontWeight: '900', fontFamily: C.font, cursor: 'pointer',
                boxShadow: '3px 3px 0 0 #000', textTransform: 'uppercase'
            }, String(val));
            qb.addEventListener('click', () => input.value = val);
            addPush(qb, '3px 3px 0 0 #000');
            quickRow.appendChild(qb);
        });
        inputRow.appendChild(quickRow);
        body.appendChild(inputRow);

        let mode = 'all';
        function setMode(m) {
            mode = m;
            btnAll.style.background = m === 'all' ? C.accent : C.white;
            btnCustom.style.background = m === 'custom' ? C.yellow : C.white;
            inputRow.style.display = m === 'custom' ? 'block' : 'none';
        }
        btnAll.addEventListener('click', () => setMode('all'));
        btnCustom.addEventListener('click', () => setMode('custom'));

        const optionsRow = el('div', { margin: '14px 0', display: 'flex', alignItems: 'center', gap: '8px' });
        const replyCheckbox = document.createElement('input');
        replyCheckbox.type = 'checkbox';
        replyCheckbox.id = 'yts-replies';
        Object.assign(replyCheckbox.style, { width: '16px', height: '16px', cursor: 'pointer' });

        const replyLabel = el('label', {
            color: C.ink, fontSize: '12px', fontWeight: '900', fontFamily: C.font,
            cursor: 'pointer', textTransform: 'uppercase'
        }, 'Pobierz odpowiedzi na komentarze');
        replyLabel.htmlFor = 'yts-replies';

        optionsRow.appendChild(replyCheckbox);
        optionsRow.appendChild(replyLabel);
        body.appendChild(optionsRow);

        body.appendChild(el('div', { borderTop: '4px solid #000', margin: '0 -16px 14px -16px' }));

        const goBtn = el('button', {
            width: '100%', padding: '14px', background: C.accent, border: C.border,
            color: C.ink, fontSize: '15px', fontWeight: '900', fontFamily: C.font,
            cursor: 'pointer', boxShadow: C.shadowMd, textTransform: 'uppercase'
        }, '▶ POBIERZ KOMENTARZE');
        addPush(goBtn, C.shadowMd);
        goBtn.addEventListener('click', () => {
            const target = mode === 'all' ? Infinity : parseInt(input.value, 10) || 100;
            const withReplies = replyCheckbox.checked;
            togglePanel();
            startScraping(target, withReplies);
        });
        body.appendChild(goBtn);
        panel.appendChild(body);

        // FOOTER - ZMODYFIKOWANY DLA MICHAŁA MARINI
        const footer = el('div', { background: C.ink, padding: '10px 16px', borderTop: C.border, textAlign: 'center' });
        const link = document.createElement('a');
        link.href = CONFIG.linkedInUrl;
        link.target = '_blank';
        Object.assign(link.style, { color: C.white, fontSize: '11px', fontWeight: '700', fontFamily: C.font, textDecoration: 'none' });
        link.textContent = '🔗 Michał Marini – połączmy się!';
        footer.appendChild(link);
        panel.appendChild(footer);

        document.body.appendChild(panel);
        document.body.appendChild(bubble);
    }

    function togglePanel() {
        if (!panel) return;
        isOpen = !isOpen;
        panel.style.display = isOpen ? 'block' : 'none';
        bubble.textContent = isOpen ? '✕' : '📥';
        isOpen ? showOverlay() : hideOverlay();
    }

    function removeUI() {
        if (bubble) { bubble.remove(); bubble = null; }
        if (panel) { panel.remove(); panel = null; }
        hideOverlay(); hideStatus(); isOpen = false;
    }

    function showStatus(text) {
        if (!statusEl) {
            statusEl = el('div', {
                position: 'fixed', bottom: '92px', right: '20px', zIndex: '2147483648',
                padding: '12px 16px', background: C.yellow, color: C.ink,
                border: C.border, boxShadow: C.shadowSm, fontSize: '13px',
                fontWeight: '700', fontFamily: C.font, maxWidth: '340px'
            });
            document.body.appendChild(statusEl);
        }
        statusEl.textContent = text;
    }

    function hideStatus() { if (statusEl) { statusEl.remove(); statusEl = null; } }

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const isWatchPage = () => location.pathname === '/watch' && location.search.includes('v=');

    function getVideoTitle() {
        const selectors = ['yt-formatted-string.style-scope.ytd-watch-metadata', 'h1.ytd-watch-metadata yt-formatted-string', 'h1'];
        for (const s of selectors) { const e = document.querySelector(s); if (e?.textContent?.trim()) return e.textContent.trim(); }
        return 'youtube-video';
    }

    function sanitize(n) { return n.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, '').substring(0, 80).trim(); }

    async function scrollToLoadComments(target) {
        const label = target === Infinity ? 'wszystkich' : target;
        showStatus(`SZUKAM KOMENTARZY (CEL: ${label})...`);

        for (let i = 0; i < 10; i++) { window.scrollBy(0, 600); await sleep(400); if (document.querySelector('ytd-comment-thread-renderer')) break; }
        let waited = 0;

        while (waited < 15000) {
            if (document.querySelector('ytd-comment-thread-renderer')) break;
            await sleep(500); waited += 500;
            showStatus(`CZEKAM NA KOMENTARZE... (${Math.round(waited/1000)}s)`);
            window.scrollBy(0, 300);
        }
        if (!document.querySelector('ytd-comment-thread-renderer')) { showStatus('BRAK KOMENTARZY.'); return 0; }

        let prev = 0, retries = 0;
        while (retries < CONFIG.maxScrollRetries) {
            const curr = document.querySelectorAll('ytd-comment-thread-renderer').length;
            if (target !== Infinity && curr >= target) { showStatus(`ZAŁADOWANO ${curr} WĄTKÓW. STOP.`); return curr; }
            window.scrollTo(0, document.documentElement.scrollHeight);
            await sleep(CONFIG.scrollPause);
            const newC = document.querySelectorAll('ytd-comment-thread-renderer').length;
            showStatus(`SCROLLUJĘ... ${newC} WĄTKÓW`);
            if (newC > prev) { prev = newC; retries = 0; } else { retries++; }
        }
        showStatus(`ZNALEZIONO ${prev} WĄTKÓW.`);
        return prev;
    }

    async function expandAllReplies(limit) {
        showStatus('ROZWIJAM ODPOWIEDZI (może potrwać)...');
        const threads = document.querySelectorAll('ytd-comment-thread-renderer');
        let expanded = 0;
        for (let i = 0; i < limit; i++) {
            const thread = threads[i];
            const existingReplies = thread.querySelectorAll('#replies ytd-comment-view-model, #replies ytd-comment-renderer');
            if (existingReplies.length === 0) {
                const expandBtn = thread.querySelector('#replies #expander button');
                if (expandBtn) {
                    expandBtn.click();
                    expanded++;
                    await sleep(450);
                }
            }
        }
        if (expanded > 0) {
             showStatus(`ROZWINIĘTO WĄTKI (${expanded}). CZEKAM NA DANE...`);
             await sleep(3500);
        }
    }

    function extractComments(target, includeReplies) {
        const threads = document.querySelectorAll('ytd-comment-thread-renderer');
        const results = [];
        const seen = new Set();
        const limit = target === Infinity ? threads.length : Math.min(target, threads.length);

        function parseCommentEl(cEl, isReply = false) {
            try {
                const authorEl = cEl.querySelector('#author-text span') || cEl.querySelector('#author-text');
                const contentEl = cEl.querySelector('#content-text');
                const dateEl = cEl.querySelector('#published-time-text') || cEl.querySelector('.published-time-text');
                const likesEl = cEl.querySelector('#vote-count-middle');

                const author = anonymizeAuthor(authorEl?.textContent?.trim() || 'Nieznany');
                const content = contentEl?.textContent?.trim() || '';
                let date = dateEl?.textContent?.trim() || '';
                date = date.replace(/\s+/g, ' ');
                const likes = likesEl?.textContent?.trim() || '0';

                if (content) {
                    const key = `${author}|${content}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({ author, content, date, likes, isReply });
                    }
                }
            } catch (e) {}
        }

        for (let i = 0; i < limit; i++) {
            const t = threads[i];

            const mc = t.querySelector('#comment');
            if (mc) parseCommentEl(mc, false);

            if (includeReplies) {
                const replies = t.querySelectorAll('#replies ytd-comment-view-model, #replies ytd-comment-renderer');
                replies.forEach(r => parseCommentEl(r, true));
            }
        }
        return results;
    }

    function formatToTxt(comments, title, url) {
        const now = new Date().toLocaleString('pl-PL');
        let txt = `${'='.repeat(60)}\nKOMENTARZE Z YOUTUBE (ZANONIMIZOWANE)\n${'='.repeat(60)}\n`;
        txt += `Film: ${title}\nURL: ${url}\nData: ${now}\nPobranych elementów: ${comments.length}\n`;
        txt += `\n⚠️ Autorzy zanonimizowani.\n${'='.repeat(60)}\n\n`;

        comments.forEach(c => {
            const indent = c.isReply ? '    ' : '';
            const prefix = c.isReply ? '↪ ' : '';
            const dividerLength = c.isReply ? 36 : 40;

            txt += `${indent}${'-'.repeat(dividerLength)}\n`;
            txt += `${indent}${prefix}${c.author} | ${c.date} | +${c.likes}\n`;

            const indentedContent = c.content.split('\n').map(line => indent + line).join('\n');
            txt += `${indentedContent}\n\n`;
        });

        // STOPKA PLIKU TEKSTOWEGO - ZMODYFIKOWANA
        txt += `${'='.repeat(60)}\nMichał Marini – połączmy się!\n${CONFIG.linkedInUrl}\n${'='.repeat(60)}`;
        return txt;
    }

    function downloadTxt(text, filename) {
        const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    }

    async function startScraping(target, withReplies) {
        if (!bubble) return;
        bubble.textContent = '⏳'; bubble.style.background = C.yellow; bubble.style.pointerEvents = 'none';
        try {
            const count = await scrollToLoadComments(target);
            if (count === 0) { resetBubble('✕'); return; }

            if (withReplies) {
                await expandAllReplies(count);
            }

            showStatus('ZBIERAM...');
            const comments = extractComments(target, withReplies);

            if (!comments.length) { showStatus('BRAK TREŚCI.'); resetBubble('✕'); return; }
            showStatus(`EKSPORTUJĘ ${comments.length}...`);
            downloadTxt(formatToTxt(comments, getVideoTitle(), location.href), `komentarze_${sanitize(getVideoTitle())}.txt`);
            showStatus(`✅ POBRANO ${comments.length}!`);
            resetBubble('✓', '#2a7a2a');
        } catch (e) { console.error(e); showStatus(`BŁĄD: ${e.message}`); resetBubble('✕'); }
    }

    function resetBubble(icon, color) {
        if (!bubble) return;
        bubble.textContent = icon; bubble.style.background = color || C.accent;
        setTimeout(() => { if (bubble) { bubble.textContent = '📥'; bubble.style.background = C.accent; bubble.style.pointerEvents = 'auto'; } hideStatus(); }, 5000);
    }

    function tryActivate() {
        if (isWatchPage()) { buildUI(); } else { removeUI(); }
    }

    window.addEventListener('yt-navigate-finish', () => setTimeout(tryActivate, 1000));
    window.addEventListener('yt-page-data-updated', () => setTimeout(tryActivate, 1000));

    setInterval(() => {
        if (isWatchPage() && !document.getElementById('yts-bubble')) {
            buildUI();
        }
    }, 3000);

    setTimeout(tryActivate, 1000);
    setTimeout(tryActivate, 3000);
    setTimeout(tryActivate, 5000);
})();
