// ==UserScript==
// @name         YT Comments Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Pobiera WSZYSTKIE komentarze i subkomentarze z YouTube. Eksport do Excel (.xlsx) lub TXT.
// @author       Michał Marini
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @run-at       document-end
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ─── STAŁE WIZUALNE ───────────────────────────────────────────────────────
    const C = {
        bg: '#FFFDF5', ink: '#000000', accent: '#FF6B6B',
        yellow: '#FFD93D', white: '#FFFFFF',
        font: "'Space Grotesk', Arial, sans-serif",
        border: '4px solid #000',
        shadowSm: '4px 4px 0px 0px #000',
        shadowMd: '8px 8px 0px 0px #000',
        shadowLg: '12px 12px 0px 0px #000',
    };

    // ─── KONFIGURACJA ─────────────────────────────────────────────────────────
    const CONFIG = {
        scrollPause:         2500,  // ms między scrollami
        maxScrollRetries:    20,    // ile razy pod rząd bez nowych komentarzy → stop
        replyExpandDelay:    500,   // ms między klikaniem "rozwiń" na wątku
        replyLoadMoreDelay:  800,   // ms po kliknięciu "więcej odpowiedzi"
        replyLoadMoreRounds: 10,    // ile rund szukania przycisku "więcej odpowiedzi"
        linkedInUrl:         'https://www.linkedin.com/in/michal-marini/'
    };

    // ─── FONT ─────────────────────────────────────────────────────────────────
    if (!document.getElementById('yts-font')) {
        const link = document.createElement('link');
        link.id = 'yts-font'; link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&display=swap';
        document.head.appendChild(link);
    }

    let bubble = null, panel = null, statusEl = null, overlay = null, isOpen = false;

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const isWatchPage = () => location.pathname === '/watch' && location.search.includes('v=');

    function el(tag, styles, text) {
        const e = document.createElement(tag);
        if (styles) Object.assign(e.style, styles);
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function addPush(btn, sh) {
        btn.addEventListener('mousedown',  () => { btn.style.transform = 'translate(3px,3px)'; btn.style.boxShadow = 'none'; });
        btn.addEventListener('mouseup',    () => { btn.style.transform = 'translate(0,0)';     btn.style.boxShadow = sh; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)';     btn.style.boxShadow = sh; });
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
            return n.length <= 2 ? '@**' : '@' + n[0] + '*'.repeat(Math.min(n.length - 2, 6)) + n[n.length - 1];
        }
        if (t.includes(' ')) {
            const p = t.split(' '); const f = p[0]; const l = p[p.length - 1];
            return (f[0] + '*'.repeat(Math.min(f.length - 1, 4))) + ' ' + (l[0] + '*'.repeat(Math.min(l.length - 1, 4)));
        }
        return t.length <= 2 ? t[0] + '*' : t[0] + '*'.repeat(Math.min(t.length - 2, 6)) + t[t.length - 1];
    }

    function getVideoTitle() {
        const selectors = [
            'yt-formatted-string.style-scope.ytd-watch-metadata',
            'h1.ytd-watch-metadata yt-formatted-string',
            'h1'
        ];
        for (const s of selectors) {
            const e = document.querySelector(s);
            if (e?.textContent?.trim()) return e.textContent.trim();
        }
        return 'youtube-video';
    }

    function sanitize(n) {
        return n.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, '').substring(0, 80).trim();
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
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
        bubble.textContent = '💬';
        addPush(bubble, C.shadowMd);
        bubble.addEventListener('click', togglePanel);

        panel = el('div', {
            position: 'fixed', bottom: '92px', right: '20px', zIndex: '2147483647',
            width: '340px', background: C.bg, border: C.border,
            boxShadow: C.shadowLg, fontFamily: C.font, display: 'none'
        });

        // Header
        const header = el('div', {
            background: C.ink, padding: '12px 16px', borderBottom: C.border,
            display: 'flex', alignItems: 'center', gap: '10px'
        });
        header.appendChild(el('span', { fontSize: '20px' }, '💬'));
        header.appendChild(el('span', {
            color: C.white, fontSize: '13px', fontWeight: '900',
            textTransform: 'uppercase', letterSpacing: '0.1em'
        }, 'YT Comment Scraper'));
        panel.appendChild(header);

        const body = el('div', { padding: '16px' });

        // Tryb: ile komentarzy
        body.appendChild(el('div', {
            color: C.ink, fontSize: '11px', fontWeight: '900',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px'
        }, 'Liczba komentarzy'));

        const modeRow = el('div', { display: 'flex', gap: '8px', marginBottom: '14px' });
        const btnAll = el('button', {
            flex: '1', padding: '10px 8px', border: C.border, background: C.accent, color: C.ink,
            fontSize: '13px', fontWeight: '900', fontFamily: C.font,
            textTransform: 'uppercase', cursor: 'pointer', boxShadow: C.shadowSm
        }, '📥 WSZYSTKIE');
        addPush(btnAll, C.shadowSm);
        const btnCustom = el('button', {
            flex: '1', padding: '10px 8px', border: C.border, background: C.white, color: C.ink,
            fontSize: '13px', fontWeight: '900', fontFamily: C.font,
            textTransform: 'uppercase', cursor: 'pointer', boxShadow: C.shadowSm
        }, '🔢 LICZBA');
        addPush(btnCustom, C.shadowSm);
        modeRow.appendChild(btnAll); modeRow.appendChild(btnCustom);
        body.appendChild(modeRow);

        const inputRow = el('div', { marginBottom: '14px', display: 'none' });
        const input = document.createElement('input');
        input.type = 'number'; input.min = '1'; input.value = '100';
        Object.assign(input.style, {
            width: '100%', padding: '12px', background: C.white, border: C.border, color: C.ink,
            boxShadow: C.shadowSm, fontSize: '16px', fontWeight: '700', fontFamily: C.font,
            boxSizing: 'border-box', outline: 'none'
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
            btnAll.style.background    = m === 'all'    ? C.accent : C.white;
            btnCustom.style.background = m === 'custom' ? C.yellow : C.white;
            inputRow.style.display     = m === 'custom' ? 'block'  : 'none';
        }
        btnAll.addEventListener('click',    () => setMode('all'));
        btnCustom.addEventListener('click', () => setMode('custom'));

        // Opcje: odpowiedzi
        const optionsRow = el('div', { margin: '14px 0', display: 'flex', alignItems: 'center', gap: '8px' });
        const replyCheckbox = document.createElement('input');
        replyCheckbox.type = 'checkbox'; replyCheckbox.id = 'yts-replies';
        replyCheckbox.checked = true; // domyślnie zaznaczony
        Object.assign(replyCheckbox.style, { width: '16px', height: '16px', cursor: 'pointer' });
        const replyLabel = el('label', {
            color: C.ink, fontSize: '12px', fontWeight: '900',
            fontFamily: C.font, cursor: 'pointer', textTransform: 'uppercase'
        }, 'Pobierz odpowiedzi na komentarze');
        replyLabel.htmlFor = 'yts-replies';
        optionsRow.appendChild(replyCheckbox); optionsRow.appendChild(replyLabel);
        body.appendChild(optionsRow);

        // Format eksportu
        body.appendChild(el('div', { borderTop: '4px solid #000', margin: '0 -16px 14px -16px' }));
        body.appendChild(el('div', {
            color: C.ink, fontSize: '11px', fontWeight: '900',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px'
        }, 'Format eksportu'));

        const fmtRow = el('div', { display: 'flex', gap: '8px', marginBottom: '14px' });
        const btnXls = el('button', {
            flex: '1', padding: '10px 8px', border: C.border, background: C.accent, color: C.ink,
            fontSize: '13px', fontWeight: '900', fontFamily: C.font,
            textTransform: 'uppercase', cursor: 'pointer', boxShadow: C.shadowSm
        }, '📊 EXCEL');
        addPush(btnXls, C.shadowSm);
        const btnTxt = el('button', {
            flex: '1', padding: '10px 8px', border: C.border, background: C.white, color: C.ink,
            fontSize: '13px', fontWeight: '900', fontFamily: C.font,
            textTransform: 'uppercase', cursor: 'pointer', boxShadow: C.shadowSm
        }, '📄 TXT');
        addPush(btnTxt, C.shadowSm);
        fmtRow.appendChild(btnXls); fmtRow.appendChild(btnTxt);
        body.appendChild(fmtRow);

        let exportFormat = 'xlsx';
        function setFormat(f) {
            exportFormat = f;
            btnXls.style.background = f === 'xlsx' ? C.accent : C.white;
            btnTxt.style.background = f === 'txt'  ? C.yellow : C.white;
        }
        btnXls.addEventListener('click', () => setFormat('xlsx'));
        btnTxt.addEventListener('click', () => setFormat('txt'));

        body.appendChild(el('div', { borderTop: '4px solid #000', margin: '0 -16px 14px -16px' }));

        const goBtn = el('button', {
            width: '100%', padding: '14px', background: C.accent, border: C.border, color: C.ink,
            fontSize: '15px', fontWeight: '900', fontFamily: C.font, cursor: 'pointer',
            boxShadow: C.shadowMd, textTransform: 'uppercase'
        }, '▶ POBIERZ KOMENTARZE');
        addPush(goBtn, C.shadowMd);
        goBtn.addEventListener('click', () => {
            const target = mode === 'all' ? Infinity : parseInt(input.value, 10) || 100;
            const withReplies = replyCheckbox.checked;
            togglePanel();
            startScraping(target, withReplies, exportFormat);
        });
        body.appendChild(goBtn);
        panel.appendChild(body);

        // Footer
        const footer = el('div', { background: C.ink, padding: '10px 16px', borderTop: C.border, textAlign: 'center' });
        const lnk = document.createElement('a');
        lnk.href = CONFIG.linkedInUrl; lnk.target = '_blank';
        Object.assign(lnk.style, {
            color: C.white, fontSize: '11px', fontWeight: '700',
            fontFamily: C.font, textDecoration: 'none'
        });
        lnk.textContent = '🔗 Michał Marini – połączmy się!';
        footer.appendChild(lnk);
        panel.appendChild(footer);

        document.body.appendChild(panel);
        document.body.appendChild(bubble);
    }

    function togglePanel() {
        if (!panel) return;
        isOpen = !isOpen;
        panel.style.display = isOpen ? 'block' : 'none';
        bubble.textContent = isOpen ? '✕' : '💬';
        isOpen ? showOverlay() : hideOverlay();
    }

    function removeUI() {
        if (bubble) { bubble.remove(); bubble = null; }
        if (panel)  { panel.remove();  panel  = null; }
        hideOverlay(); hideStatus(); isOpen = false;
    }

    function showStatus(text) {
        if (!statusEl) {
            statusEl = el('div', {
                position: 'fixed', bottom: '92px', right: '20px', zIndex: '2147483648',
                padding: '12px 16px', background: C.yellow, color: C.ink,
                border: C.border, boxShadow: C.shadowSm, fontSize: '13px',
                fontWeight: '700', fontFamily: C.font, maxWidth: '360px'
            });
            document.body.appendChild(statusEl);
        }
        statusEl.textContent = text;
    }
    function hideStatus() { if (statusEl) { statusEl.remove(); statusEl = null; } }

    // ─── KROK 1: SCROLL DO ZAŁADOWANIA WSZYSTKICH KOMENTARZY ─────────────────
    async function scrollToLoadComments(target) {
        const label = target === Infinity ? 'wszystkich' : target;
        showStatus(`SZUKAM KOMENTARZY (CEL: ${label})...`);

        // Wstępne scrollowanie – uruchamia ładowanie sekcji komentarzy
        for (let i = 0; i < 15; i++) {
            window.scrollBy(0, 600);
            await sleep(400);
            if (document.querySelector('ytd-comment-thread-renderer')) break;
        }

        // Czekaj na pierwszy komentarz (max 20s)
        let waited = 0;
        while (waited < 20000) {
            if (document.querySelector('ytd-comment-thread-renderer')) break;
            await sleep(500); waited += 500;
            showStatus(`CZEKAM NA KOMENTARZE... (${Math.round(waited / 1000)}s)`);
            window.scrollBy(0, 300);
        }

        if (!document.querySelector('ytd-comment-thread-renderer')) {
            showStatus('BRAK KOMENTARZY.');
            return 0;
        }

        let prev = 0, retries = 0;

        while (retries < CONFIG.maxScrollRetries) {
            const curr = document.querySelectorAll('ytd-comment-thread-renderer').length;

            if (target !== Infinity && curr >= target) {
                showStatus(`ZAŁADOWANO ${curr} WĄTKÓW. STOP.`);
                return curr;
            }

            // Jeśli YT aktualnie ładuje (spinner), nie licz jako nieudana próba
            const spinner = document.querySelector(
                'ytd-comments-header-renderer tp-yt-paper-spinner[active], ' +
                'ytd-item-section-renderer ytd-spinner[active], ' +
                '#continuations ytd-spinner, ' +
                '#comments ytd-spinner[active], ' +
                '#comments tp-yt-paper-spinner[active], ' +
                'ytd-comments ytd-spinner[active]'
            );
            if (spinner) {
                showStatus(`YT ŁADUJE... ${curr} WĄTKÓW (czekam na spinner)`);
                await sleep(CONFIG.scrollPause);
                continue;
            }

            window.scrollTo(0, document.documentElement.scrollHeight);
            await sleep(CONFIG.scrollPause);

            const newC = document.querySelectorAll('ytd-comment-thread-renderer').length;
            showStatus(`SCROLLUJĘ... ${newC} WĄTKÓW (próba ${retries + 1}/${CONFIG.maxScrollRetries})`);

            if (newC > prev) {
                prev = newC;
                retries = 0; // reset – pojawiły się nowe
            } else {
                retries++;
            }
        }

        showStatus(`ZNALEZIONO ${prev} WĄTKÓW.`);
        return prev;
    }

    // ─── KROK 2: ROZWIJANIE WSZYSTKICH ODPOWIEDZI ─────────────────────────────
    async function expandAllReplies(limit) {
        const threads = document.querySelectorAll('ytd-comment-thread-renderer');
        const threadLimit = Math.min(limit, threads.length);

        // FAZA 1: Kliknij "Wyświetl X odpowiedzi" na każdym wątku
        showStatus('ROZWIJAM ODPOWIEDZI – FAZA 1...');
        let expanded = 0;

        for (let i = 0; i < threadLimit; i++) {
            const thread = threads[i];
            const expandBtn = thread.querySelector(
                '#replies #expander #expander-item tp-yt-paper-button, ' +
                '#replies #expander tp-yt-paper-button#expander-item, ' +
                '#replies #more-replies button, ' +
                '#replies ytd-button-renderer button, ' +
                '#replies tp-yt-paper-button[aria-expanded="false"], ' +
                '#replies yt-button-shape button'
            );
            if (expandBtn && expandBtn.offsetParent !== null) {
                expandBtn.click();
                expanded++;
                await sleep(CONFIG.replyExpandDelay);
                if (i % 10 === 0) showStatus(`ROZWIJAM FAZA 1: ${i + 1}/${threadLimit}...`);
            }
        }

        if (expanded > 0) {
            const waitTime = Math.min(4000 + expanded * 150, 20000);
            showStatus(`CZEKAM NA ZAŁADOWANIE ODPOWIEDZI... (${Math.round(waitTime / 1000)}s)`);
            await sleep(waitTime);
        }

        // FAZA 2: Klikaj "Więcej odpowiedzi" (wątki z >10 odpowiedziami)
        showStatus('ROZWIJAM ODPOWIEDZI – FAZA 2 (więcej odpowiedzi)...');

        for (let round = 0; round < CONFIG.replyLoadMoreRounds; round++) {
            const freshThreads = document.querySelectorAll('ytd-comment-thread-renderer');
            let clicked = 0;

            for (let i = 0; i < Math.min(limit, freshThreads.length); i++) {
                const thread = freshThreads[i];
                const moreBtn = thread.querySelector(
                    '#replies ytd-continuation-item-renderer tp-yt-paper-button, ' +
                    '#replies ytd-continuation-item-renderer button, ' +
                    '#replies #continuation tp-yt-paper-button, ' +
                    '#replies ytd-continuation-item-renderer yt-button-shape button'
                );
                if (moreBtn && moreBtn.offsetParent !== null) {
                    moreBtn.click();
                    clicked++;
                    await sleep(CONFIG.replyLoadMoreDelay);
                }
            }

            if (clicked === 0) {
                showStatus(`FAZA 2: koniec po rundzie ${round + 1}.`);
                break;
            }
            showStatus(`FAZA 2 – runda ${round + 1}: kliknięto ${clicked}. Czekam...`);
            await sleep(3500);
        }

        showStatus('✅ ODPOWIEDZI ZAŁADOWANE.');
    }

    // ─── KROK 3: ZBIERANIE KOMENTARZY Z DOM ──────────────────────────────────
    function extractComments(target, includeReplies) {
        const threads = document.querySelectorAll('ytd-comment-thread-renderer');
        const results = [];
        const seen = new Set();
        const limit = target === Infinity ? threads.length : Math.min(target, threads.length);

        function parseCommentEl(cEl, isReply) {
            try {
                const authorEl  = cEl.querySelector('#author-text span, #author-text, [id="author-text"]');
                const contentEl = cEl.querySelector('#content-text, [id="content-text"], yt-formatted-string#content-text');
                const dateEl    = cEl.querySelector('#published-time-text, .published-time-text, [id="published-time-text"]');
                const likesEl   = cEl.querySelector('#vote-count-middle, [id="vote-count-middle"], #vote-count');

                const author  = anonymizeAuthor(authorEl?.textContent?.trim() || 'Nieznany');
                const content = contentEl?.textContent?.trim() || '';
                const date    = (dateEl?.textContent?.trim() || '').replace(/\s+/g, ' ');
                const likes   = likesEl?.textContent?.trim() || '0';

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
            const mc = t.querySelector('#comment, [id="comment"]');
            if (mc) parseCommentEl(mc, false);

            if (includeReplies) {
                const replies = t.querySelectorAll(
                    '#replies ytd-comment-view-model, ' +
                    '#replies ytd-comment-renderer, ' +
                    '#replies [id="comment"]'
                );
                replies.forEach(r => parseCommentEl(r, true));
            }
        }

        return results;
    }

    // ─── EKSPORT: EXCEL (.xlsx) ───────────────────────────────────────────────
    function exportToXlsx(comments, title, url) {
        const now = new Date().toLocaleString('pl-PL');
        const wb  = XLSX.utils.book_new();

        const ws = XLSX.utils.aoa_to_sheet([
            [`Film: ${title}`],
            [`URL: ${url}`],
            [`Data pobrania: ${now}`],
            [`Łącznie: ${comments.length} elementów (autorzy zanonimizowani)`],
            [],
            ['Nr', 'Typ', 'Autor', 'Data', 'Lajki', 'Treść komentarza'],
            ...comments.map((c, i) => [
                i + 1,
                c.isReply ? 'Odpowiedź' : 'Komentarz',
                c.author,
                c.date,
                c.likes,
                c.content
            ])
        ]);

        ws['!cols'] = [
            { wch: 5 },   // Nr
            { wch: 12 },  // Typ
            { wch: 18 },  // Autor
            { wch: 16 },  // Data
            { wch: 8 },   // Lajki
            { wch: 80 },  // Treść
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Komentarze');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob  = new Blob([wbout], { type: 'application/octet-stream' });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl; a.download = `komentarze_${sanitize(title)}.xlsx`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(dlUrl); }, 1000);
    }

    // ─── EKSPORT: TXT ─────────────────────────────────────────────────────────
    function exportToTxt(comments, title, url) {
        const now = new Date().toLocaleString('pl-PL');
        let txt = `${'='.repeat(60)}\nKOMENTARZE Z YOUTUBE (ZANONIMIZOWANE)\n${'='.repeat(60)}\n`;
        txt += `Film: ${title}\nURL: ${url}\nData: ${now}\nPobranych: ${comments.length}\n`;
        txt += `\n⚠️ Autorzy zanonimizowani.\n${'='.repeat(60)}\n\n`;
        comments.forEach(c => {
            const indent = c.isReply ? '    ' : '';
            const prefix = c.isReply ? '↪ '  : '';
            const divLen = c.isReply ? 36 : 40;
            txt += `${indent}${'-'.repeat(divLen)}\n`;
            txt += `${indent}${prefix}${c.author} | ${c.date} | +${c.likes}\n`;
            txt += c.content.split('\n').map(line => indent + line).join('\n') + '\n\n';
        });
        txt += `${'='.repeat(60)}\nMichał Marini – połączmy się!\n${CONFIG.linkedInUrl}\n${'='.repeat(60)}`;

        const blob = new Blob(['\uFEFF' + txt], { type: 'text/plain;charset=utf-8' });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl; a.download = `komentarze_${sanitize(title)}.txt`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(dlUrl); }, 1000);
    }

    // ─── DIAGNOSTYKA SELEKTORÓW ───────────────────────────────────────────────
    function runDiagnostic() {
        const thread = document.querySelector('ytd-comment-thread-renderer');
        if (!thread) {
            console.warn('[YT Scraper] Brak ytd-comment-thread-renderer w DOM');
            return '❌ YT zmienił strukturę strony. Zgłoś błąd na github.com/MrCanon19/YT-Comments-Scraper';
        }
        const tests = [
            { name: 'kontener',  sel: '#comment, [id="comment"]' },
            { name: 'autor',     sel: '#author-text span, #author-text, [id="author-text"]' },
            { name: 'treść',     sel: '#content-text, [id="content-text"]' },
            { name: 'data',      sel: '#published-time-text, .published-time-text, [id="published-time-text"]' },
        ];
        const failed = tests.filter(t => !thread.querySelector(t.sel)).map(t => t.name);
        if (failed.length === 0) {
            console.warn('[YT Scraper] Selektory OK, komentarze puste');
            return '⚠️ Selektory OK, ale komentarze puste. Odśwież stronę i spróbuj ponownie.';
        }
        console.warn('[YT Scraper] Zepsute selektory:', failed);
        return `❌ Zepsute selektory: ${failed.join(', ')}. Zgłoś błąd na github.com/MrCanon19/YT-Comments-Scraper`;
    }

    // ─── GŁÓWNA FUNKCJA SCRAPOWANIA ───────────────────────────────────────────
    async function startScraping(target, withReplies, exportFormat) {
        if (!bubble) return;
        bubble.textContent = '⏳'; bubble.style.background = C.yellow; bubble.style.pointerEvents = 'none';

        try {
            const count = await scrollToLoadComments(target);
            if (count === 0) { resetBubble('✕'); return; }

            if (withReplies) {
                await expandAllReplies(count);
            }

            showStatus('ZBIERAM DANE...');
            const comments = extractComments(target, withReplies);

            if (!comments.length) {
                const diagnosis = runDiagnostic();
                showStatus(diagnosis);
                resetBubble('✕');
                return;
            }

            showStatus(`EKSPORTUJĘ ${comments.length} elementów...`);
            const title = getVideoTitle();

            if (exportFormat === 'xlsx') {
                if (typeof XLSX === 'undefined') {
                    // Fallback do TXT jeśli SheetJS nie załadowany
                    exportToTxt(comments, title, location.href);
                    showStatus(`✅ POBRANO ${comments.length} → TXT (brak SheetJS)`);
                } else {
                    exportToXlsx(comments, title, location.href);
                    showStatus(`✅ POBRANO ${comments.length} → Excel`);
                }
            } else {
                exportToTxt(comments, title, location.href);
                showStatus(`✅ POBRANO ${comments.length} → TXT`);
            }

            resetBubble('✓', '#2a7a2a');

        } catch (e) {
            console.error('[YT Scraper]', e);
            showStatus(`BŁĄD: ${e.message}`);
            resetBubble('✕');
        }
    }

    function resetBubble(icon, color) {
        if (!bubble) return;
        bubble.textContent = icon; bubble.style.background = color || C.accent;
        setTimeout(() => {
            if (bubble) {
                bubble.textContent = '💬';
                bubble.style.background = C.accent;
                bubble.style.pointerEvents = 'auto';
            }
            hideStatus();
        }, 5000);
    }

    // ─── AKTYWACJA ────────────────────────────────────────────────────────────
    function tryActivate() {
        if (isWatchPage()) { buildUI(); } else { removeUI(); }
    }

    window.addEventListener('yt-navigate-finish',   () => setTimeout(tryActivate, 1000));
    window.addEventListener('yt-page-data-updated', () => setTimeout(tryActivate, 1000));

    setInterval(() => {
        if (isWatchPage() && !document.getElementById('yts-bubble')) buildUI();
    }, 3000);

    setTimeout(tryActivate, 1000);
    setTimeout(tryActivate, 3000);
    setTimeout(tryActivate, 5000);

    console.log('[YT Scraper] >>> URUCHOMIONY <<<');
})();
