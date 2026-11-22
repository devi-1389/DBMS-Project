/**
 * SOLACE - shared front-end behaviour
 */
(function () {
    'use strict';

    // Bootstrap modals must live directly under <body>: if a modal sits inside an element that forms a
    // stacking context (animations, transforms, sticky layouts) it is drawn beneath its own backdrop and
    // cannot be clicked. Moving them once at start-up keeps every form inside them working unchanged.
    document.querySelectorAll('.modal').forEach((modal) => {
        if (modal.parentElement !== document.body) document.body.appendChild(modal);
    });

    // Toast notifications: dismiss on click, auto-hide after 6s (errors stay 10s)
    document.querySelectorAll('.toast-lux').forEach((toast) => {
        const hide = () => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); };
        const btn = toast.querySelector('[data-dismiss-toast]');
        if (btn) btn.addEventListener('click', hide);
        setTimeout(hide, toast.classList.contains('danger') ? 10000 : 6000);
    });

    // Bootstrap tooltips
    if (window.bootstrap) {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => new bootstrap.Tooltip(el));
    }

    // Reveal-on-scroll animation
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach((el) => io.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add('is-visible'));
    }

    // Confirmation prompts for destructive actions: <form data-confirm="...">
    document.querySelectorAll('form[data-confirm]').forEach((form) => {
        form.addEventListener('submit', (e) => {
            if (!window.confirm(form.dataset.confirm)) e.preventDefault();
        });
    });

    // Prevent double submission of forms
    document.querySelectorAll('form').forEach((form) => {
        form.addEventListener('submit', (e) => {
            if (e.defaultPrevented || form.dataset.allowResubmit !== undefined) return;
            setTimeout(() => form.querySelectorAll('button[type="submit"]').forEach((b) => { b.disabled = true; }), 0);
        });
    });

    // Live price calculation on the booking page
    const partyInput = document.getElementById('bookingPartySize');
    const totalEl = document.getElementById('bookingTotalPrice');
    if (partyInput && totalEl) {
        const unit = parseFloat(totalEl.dataset.unitPrice) || 0;
        const pricing = totalEl.dataset.pricingType;
        const update = () => {
            const party = parseInt(partyInput.value, 10) || 1;
            const total = pricing === 'per_person' ? unit * party : unit;
            totalEl.textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        partyInput.addEventListener('input', update);
        update();
    }

    // Range inputs that mirror their value into a label: <input type=range data-output="#id">
    document.querySelectorAll('input[type="range"][data-output]').forEach((input) => {
        const out = document.querySelector(input.dataset.output);
        const labels = (input.dataset.labels || '').split('|');
        const sync = () => { if (out) out.textContent = labels[input.value - 1] || input.value; };
        input.addEventListener('input', sync);
        sync();
    });

    // Animate progress bars from 0 to their target width
    document.querySelectorAll('.progress-lux > span[data-width]').forEach((bar) => {
        requestAnimationFrame(() => { bar.style.width = bar.dataset.width + '%'; });
    });

    // Fallback for images that fail to load: data-fallback attribute
    document.querySelectorAll('img[data-fallback]').forEach((img) => {
        img.addEventListener('error', () => { if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback; }, { once: true });
    });
})();

/** Escape text for safe insertion into HTML (used by the SQL laboratory renderer). */
window.solaceEscape = function (value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};

/** Minimal SQL syntax highlighter for <pre class="code-block" data-sql>. */
window.solaceHighlightSQL = function (root) {
    const KW = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|JOIN|INNER|LEFT|RIGHT|ON|AS|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|TEMPORARY|ALTER|ADD|DROP|MODIFY|COLUMN|CONSTRAINT|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|NULL|IS|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|DISTINCT|CALL|SHOW|DESCRIBE|VIEW|INDEX|ON DUPLICATE KEY|DESC|ASC|AUTO_INCREMENT|TRUE|FALSE|IF|WITH|UNION|ALL|DUPLICATE|INT|VARCHAR|DECIMAL|DATE|TIME|TRIGGER|PROCEDURE|FUNCTION|BEGIN|DECLARE|RETURN|RETURNS|SIGNAL|SQLSTATE|FOR|EACH|ROW|AFTER|BEFORE|NEW|OLD|INTERVAL)\b/g;
    const FN = /\b(COUNT|SUM|AVG|MIN|MAX|ROUND|COALESCE|CONCAT|NOW|CURDATE|DATE_ADD|DATE_SUB|DAYNAME|TIME_FORMAT|HOUR|LAST_INSERT_ID|CAST|JSON_OBJECT|TIMESTAMP|NULLIF|GREATEST|fn_\w+|sp_\w+)\b(?=\s*\()/g;
    (root || document).querySelectorAll('pre[data-sql]').forEach((pre) => {
        const raw = pre.textContent;
        const tokens = [];
        let html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/(--[^\n]*)/g, (m) => { tokens.push(`<span class="cm">${m}</span>`); return `\u0001T${tokens.length - 1}\u0001`; })
            .replace(/('(?:[^'\\]|\\.)*')/g, (m) => { tokens.push(`<span class="str">${m}</span>`); return `\u0001T${tokens.length - 1}\u0001`; });
        html = html.replace(FN, '<span class="fn">$1</span>').replace(KW, '<span class="kw">$1</span>')
                   .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>')
                   .replace(/\u0001T(\d+)\u0001/g, (_, i) => tokens[+i]);
        pre.innerHTML = html;
    });
};
document.addEventListener('DOMContentLoaded', () => window.solaceHighlightSQL());
