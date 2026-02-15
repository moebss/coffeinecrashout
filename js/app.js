/**
 * CoffeineCrashout – Main Application Logic
 */

// ===========================
// i18n / Language System
// ===========================
let currentLang = 'en';
let translations = {};

async function initLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    currentLang = browserLang.startsWith('de') ? 'de' : 'en';

    try {
        const response = await fetch(`i18n/${currentLang}.json`);
        translations = await response.json();
    } catch (e) {
        currentLang = 'en';
        const response = await fetch('i18n/en.json');
        translations = await response.json();
    }

    applyTranslations();
}

function t(path) {
    const keys = path.split('.');
    let value = translations;
    for (const key of keys) {
        value = value?.[key];
    }
    return value || path;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val && typeof val === 'string') {
            if (el.tagName === 'INPUT' && el.type !== 'submit') {
                el.placeholder = val;
            } else {
                el.textContent = val;
            }
        }
    });
}

// ===========================
// State
// ===========================
let drinkCounts = {};
let analysisResult = null;
let timelineChart = null;

// ===========================
// Drink Selector
// ===========================
const DRINK_EMOJIS = {
    coffee: '☕', espresso: '⚫', cappuccino: '🤎', latte: '🥛',
    energyDrink: '⚡', cola: '🥤', tea: '🫖', mateLemonade: '🧉', decaf: '💤'
};

function renderDrinkSelector() {
    const container = document.getElementById('drinkGrid');
    if (!container) return;
    container.innerHTML = '';

    const drinks = caffeineCalc.DRINKS;

    for (const [key, mg] of Object.entries(drinks)) {
        const count = drinkCounts[key] || 0;
        const drinkDiv = document.createElement('div');
        drinkDiv.className = `drink-card ${count > 0 ? 'active' : ''}`;
        drinkDiv.innerHTML = `
            <div class="drink-emoji">${DRINK_EMOJIS[key] || '☕'}</div>
            <div class="drink-name">${t(`drinks.${key}`)}</div>
            <div class="drink-mg">${mg} mg</div>
            <div class="drink-counter">
                <button class="drink-btn minus" data-drink="${key}" data-action="minus" aria-label="Minus">−</button>
                <span class="drink-count">${count}</span>
                <button class="drink-btn plus" data-drink="${key}" data-action="plus" aria-label="Plus">+</button>
            </div>
        `;
        container.appendChild(drinkDiv);
    }

    container.onclick = (e) => {
        const btn = e.target.closest('.drink-btn');
        if (!btn) return;

        const drink = btn.dataset.drink;
        const action = btn.dataset.action;

        if (action === 'plus') {
            drinkCounts[drink] = (drinkCounts[drink] || 0) + 1;
        } else if (action === 'minus' && drinkCounts[drink] > 0) {
            drinkCounts[drink]--;
            if (drinkCounts[drink] === 0) delete drinkCounts[drink];
        }

        document.getElementById('caffeineInput').value = caffeineCalc.drinkTotal(drinkCounts) || '';
        renderDrinkSelector();
    };
}

// ===========================
// Form Handling
// ===========================
function initForm() {
    const calculateBtn = document.getElementById('calculateBtn');

    calculateBtn?.addEventListener('click', (e) => {
        e.preventDefault();

        const weight = parseFloat(document.getElementById('weightInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);
        const age = parseFloat(document.getElementById('ageInput').value) || 30;
        const caffeine = parseFloat(document.getElementById('caffeineInput').value);
        const gender = document.querySelector('input[name="gender"]:checked')?.value || 'diverse';

        // Validation
        if (!weight || weight < 20 || weight > 300) {
            shakeElement(document.getElementById('weightInput'));
            return;
        }
        if (!height || height < 100 || height > 250) {
            shakeElement(document.getElementById('heightInput'));
            return;
        }
        if (!caffeine || caffeine < 0) {
            shakeElement(document.getElementById('caffeineInput'));
            return;
        }

        // Full analysis
        analysisResult = caffeineCalc.analyze(weight, height, age, gender, caffeine);
        showResults();
    });
}

function shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
}

// ===========================
// Results Display
// ===========================
function showResults() {
    if (!analysisResult) return;
    const r = analysisResult;

    // Transition
    document.getElementById('inputSection').classList.add('hidden');
    document.getElementById('resultSection').classList.remove('hidden');
    document.getElementById('resultSection').classList.add('fade-in');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Risk gauge
    renderRiskGauge(r);

    // Stats
    document.getElementById('statIntake').textContent = `${r.caffeineMg} mg`;
    document.getElementById('statPerKg').textContent = `${r.concentration} mg/L`;
    document.getElementById('statLimit').textContent = `${r.limit} mg`;
    document.getElementById('statOverLimit').textContent = `${r.percentage}%`;

    // Comparison text
    const compEl = document.getElementById('comparison');
    if (r.percentile > 50) {
        compEl.textContent = t('result.comparison').replace('{percent}', r.percentile);
    } else {
        compEl.textContent = t('result.comparisonLow');
    }

    // Badge
    const badgeEl = document.getElementById('badgeDisplay');
    badgeEl.textContent = t(`badges.${r.badge}`);
    badgeEl.className = `badge badge-${r.riskKey}`;

    // Effects
    renderEffects(r);

    // Timeline chart
    renderTimeline(r.timeline);

    // Fun fact
    const facts = t('funFacts');
    if (Array.isArray(facts)) {
        document.getElementById('funFact').textContent = facts[r.funFactIndex] || facts[0];
    }

    // Animate
    animateResultElements();
}

function renderRiskGauge(r) {
    const gauge = document.getElementById('riskGauge');
    const label = document.getElementById('riskLabel');
    const desc = document.getElementById('riskDesc');

    label.textContent = t(`risk.${r.riskKey}`);
    desc.textContent = t(`risk.${r.riskKey}Desc`);

    const colors = { low: '#66BB6A', moderate: '#FFC107', high: '#FF8A65', extreme: '#E53935' };
    gauge.style.setProperty('--gauge-color', colors[r.riskKey]);

    setTimeout(() => {
        gauge.querySelector('.gauge-fill').style.width = `${r.riskPercent}%`;
    }, 300);
}

function renderEffects(r) {
    const shortTermEl = document.getElementById('shortTermEffects');
    const longTermEl = document.getElementById('longTermEffects');

    shortTermEl.innerHTML = r.shortTermEffects.length
        ? r.shortTermEffects.map(e => `<div class="effect-tag effect-short">${t(`effects.${e}`)}</div>`).join('')
        : `<div class="effect-tag effect-none">✅ ${t('effects.alertness')}</div>`;

    longTermEl.innerHTML = r.longTermRisks.length
        ? r.longTermRisks.map(e => `<div class="effect-tag effect-long">${t(`effects.${e}`)}</div>`).join('')
        : '<div class="effect-tag effect-none">✅ Keine nennenswerten Risiken</div>';
}

function renderTimeline(timeline) {
    const ctx = document.getElementById('timelineChart')?.getContext('2d');
    if (!ctx) return;
    if (timelineChart) timelineChart.destroy();

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeline.labels,
            datasets: [{
                label: 'Caffeine (mg)',
                data: timeline.data,
                borderColor: '#81C784',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx: c, chartArea } = chart;
                    if (!chartArea) return 'rgba(129,199,132,0.1)';
                    const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    grad.addColorStop(0, 'rgba(129,199,132,0.35)');
                    grad.addColorStop(1, 'rgba(129,199,132,0.02)');
                    return grad;
                },
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: timeline.colors,
                pointBorderColor: timeline.colors,
                borderWidth: 2.5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(62,39,35,0.9)',
                    titleFont: { family: "'Inter', sans-serif", size: 13 },
                    bodyFont: { family: "'Inter', sans-serif", size: 12 },
                    padding: 12, cornerRadius: 8,
                    callbacks: { label: (c) => `${c.parsed.y} mg Koffein im Blut` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(161,136,127,0.1)' }, ticks: { color: '#A1887F', font: { size: 11 } } },
                y: { grid: { color: 'rgba(161,136,127,0.1)' }, ticks: { color: '#A1887F', font: { size: 11 } }, beginAtZero: true }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

function animateResultElements() {
    document.querySelectorAll('.result-animate').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 150 * i);
    });
}

// ===========================
// Coffein Wrapped – Canvas Image Generator
// ===========================
function initWrapped() {
    document.getElementById('wrappedBtn')?.addEventListener('click', generateWrapped);
}

async function generateWrapped() {
    if (!analysisResult) return;
    const r = analysisResult;

    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Background ──
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, 0, W, H);

    // Decorative top bar
    const barGrad = ctx.createLinearGradient(0, 0, W, 0);
    barGrad.addColorStop(0, '#81C784');
    barGrad.addColorStop(0.5, '#FFD54F');
    barGrad.addColorStop(1, '#A1887F');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 12);

    // ── Branding ──
    ctx.fillStyle = '#3E2723';
    ctx.font = '900 72px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☕ CoffeineCrashout', W / 2, 120);

    ctx.font = '400 32px "Inter", sans-serif';
    ctx.fillStyle = '#6D4C41';
    ctx.fillText('Dein persönlicher Koffein-Report', W / 2, 175);

    // ── Divider ──
    ctx.strokeStyle = '#D7CCC8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 220);
    ctx.lineTo(W - 100, 220);
    ctx.stroke();

    // ── Badge / Personality Type ──
    const badgeText = t(`badges.${r.badge}`);
    const riskColors = { low: '#66BB6A', moderate: '#FFC107', high: '#FF8A65', extreme: '#E53935' };
    const riskBgColors = { low: '#C8E6C9', moderate: '#FFF8E1', high: '#FFF3E0', extreme: '#FFEBEE' };
    const riskColor = riskColors[r.riskKey];
    const riskBg = riskBgColors[r.riskKey];

    // Badge pill
    ctx.fillStyle = riskBg;
    roundRect(ctx, 200, 260, W - 400, 100, 50);
    ctx.fill();
    ctx.strokeStyle = riskColor;
    ctx.lineWidth = 3;
    roundRect(ctx, 200, 260, W - 400, 100, 50);
    ctx.stroke();
    ctx.fillStyle = riskColor;
    ctx.font = '700 42px "Space Grotesk", sans-serif';
    ctx.fillText(badgeText, W / 2, 325);

    // ── Risk Label ──
    ctx.fillStyle = '#3E2723';
    ctx.font = '700 52px "Space Grotesk", sans-serif';
    ctx.fillText(t(`risk.${r.riskKey}`), W / 2, 430);

    ctx.font = '400 28px "Inter", sans-serif';
    ctx.fillStyle = '#6D4C41';
    ctx.fillText(t(`risk.${r.riskKey}Desc`), W / 2, 475);

    // ── Risk Gauge ──
    const gaugeY = 520, gaugeH = 24, gaugeW = W - 200;
    ctx.fillStyle = '#D7CCC8';
    roundRect(ctx, 100, gaugeY, gaugeW, gaugeH, 12);
    ctx.fill();
    const fillW = Math.max(24, (r.riskPercent / 100) * gaugeW);
    const gaugeGrad = ctx.createLinearGradient(100, 0, 100 + fillW, 0);
    gaugeGrad.addColorStop(0, '#66BB6A');
    gaugeGrad.addColorStop(0.5, fillW > gaugeW * 0.5 ? '#FFC107' : '#81C784');
    gaugeGrad.addColorStop(1, riskColor);
    ctx.fillStyle = gaugeGrad;
    roundRect(ctx, 100, gaugeY, fillW, gaugeH, 12);
    ctx.fill();

    // Gauge labels
    ctx.font = '500 22px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#66BB6A';
    ctx.fillText('Safe', 100, gaugeY + 55);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#E53935';
    ctx.fillText('Extreme', W - 100, gaugeY + 55);
    ctx.textAlign = 'center';

    // ── Stats Grid (2x2) ──
    const statsY = 630;
    const statsData = [
        { value: `${r.caffeineMg} mg`, label: 'Täglicher Konsum' },
        { value: `${r.limit} mg`, label: 'Dein Limit' },
        { value: `${r.yearlyKg} kg`, label: 'Jahreskonsum' },
        { value: `${r.tbw} L`, label: 'Körperwasser (TBW)' }
    ];

    const cardW = 400, cardH = 140, gap = 40;
    statsData.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = (W - cardW * 2 - gap) / 2 + col * (cardW + gap);
        const y = statsY + row * (cardH + 20);

        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, x, y, cardW, cardH, 16);
        ctx.fill();
        ctx.strokeStyle = '#D7CCC8';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, cardW, cardH, 16);
        ctx.stroke();

        ctx.fillStyle = '#66BB6A';
        ctx.font = '700 44px "Space Grotesk", sans-serif';
        ctx.fillText(s.value, x + cardW / 2, y + 60);

        ctx.fillStyle = '#A1887F';
        ctx.font = '600 20px "Inter", sans-serif';
        ctx.fillText(s.label, x + cardW / 2, y + 100);
    });

    // ── Comparison Text ──
    const compY = statsY + 2 * (cardH + 20) + 40;
    ctx.fillStyle = '#FFF8E1';
    roundRect(ctx, 80, compY, W - 160, 80, 16);
    ctx.fill();
    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 80, compY, W - 160, 80, 16);
    ctx.stroke();

    ctx.fillStyle = '#6D4C41';
    ctx.font = '500 26px "Inter", sans-serif';
    if (r.percentile > 50) {
        ctx.fillText(`Mehr Koffein als ${r.percentile}% der Bevölkerung 😱`, W / 2, compY + 48);
    } else {
        ctx.fillText('Dein Konsum liegt im normalen Bereich ✅', W / 2, compY + 48);
    }

    // ── Effects ──
    const fxY = compY + 130;
    ctx.fillStyle = '#3E2723';
    ctx.font = '700 36px "Space Grotesk", sans-serif';
    ctx.fillText('Effekte & Risiken', W / 2, fxY);

    ctx.font = '500 24px "Inter", sans-serif';
    const allEffects = [
        ...r.shortTermEffects.map(e => ({ text: t(`effects.${e}`), type: 'short' })),
        ...r.longTermRisks.map(e => ({ text: t(`effects.${e}`), type: 'long' }))
    ];

    if (allEffects.length === 0) {
        allEffects.push({ text: '✅ Keine nennenswerten Risiken', type: 'none' });
    }

    // Lay out effect pills
    let pillX = 100, pillY = fxY + 30;
    const pillH = 44, pillGap = 12;
    allEffects.forEach(fx => {
        const tw = ctx.measureText(fx.text).width + 40;
        if (pillX + tw > W - 100) {
            pillX = 100;
            pillY += pillH + pillGap;
        }
        ctx.fillStyle = fx.type === 'short' ? '#FFF8E1' : (fx.type === 'long' ? '#FFEBEE' : '#C8E6C9');
        roundRect(ctx, pillX, pillY, tw, pillH, 22);
        ctx.fill();
        ctx.fillStyle = fx.type === 'short' ? '#F57F17' : (fx.type === 'long' ? '#E53935' : '#2E7D32');
        ctx.fillText(fx.text, pillX + tw / 2, pillY + 30);
        pillX += tw + pillGap;
    });

    // ── Fun Fact ──
    const factY = pillY + pillH + 60;
    ctx.fillStyle = '#FFF8E1';
    roundRect(ctx, 80, factY, W - 160, 90, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,213,79,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 80, factY, W - 160, 90, 16);
    ctx.stroke();

    ctx.fillStyle = '#6D4C41';
    ctx.font = '400 24px "Inter", sans-serif';
    const facts = t('funFacts');
    const factText = Array.isArray(facts) ? (facts[r.funFactIndex] || facts[0]) : '';
    wrapText(ctx, `💡 ${factText}`, W / 2, factY + 35, W - 240, 32);

    // ── Half-life Info ──
    const hlY = factY + 130;
    ctx.fillStyle = '#A1887F';
    ctx.font = '500 24px "Inter", sans-serif';
    ctx.fillText(`Halbwertszeit: ${r.timeline.halfLife}h | Konzentration: ${r.concentration} mg/L`, W / 2, hlY);

    // ── Footer / Branding ──
    ctx.fillStyle = '#D7CCC8';
    ctx.font = '400 22px "Inter", sans-serif';
    ctx.fillText('coffeinecrashout.vercel.app', W / 2, H - 80);

    ctx.fillStyle = '#A1887F';
    ctx.font = '400 20px "Inter", sans-serif';
    ctx.fillText('⚠️ Keine ärztliche Beratung. Alle Angaben ohne Gewähr.', W / 2, H - 45);

    // Bottom bar
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, H - 12, W, 12);

    // ── Download ──
    const link = document.createElement('a');
    link.download = `coffeine-wrapped-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Canvas helpers
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = test;
        }
    }
    lines.push(line.trim());
    const startY = y;
    lines.forEach((l, i) => {
        ctx.fillText(l, x, startY + i * lineHeight);
    });
}

// ===========================
// New Analysis
// ===========================
function initNewAnalysis() {
    document.getElementById('newAnalysisBtn')?.addEventListener('click', () => {
        document.getElementById('resultSection').classList.add('hidden');
        document.getElementById('inputSection').classList.remove('hidden');
        document.getElementById('inputSection').classList.add('fade-in');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===========================
// Landing Page CTA
// ===========================
function initLanding() {
    document.getElementById('ctaBtn')?.addEventListener('click', () => {
        document.getElementById('landingSection').classList.add('hidden');
        document.getElementById('inputSection').classList.remove('hidden');
        document.getElementById('inputSection').classList.add('fade-in');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===========================
// Particles Background
// ===========================
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const COUNT = 50;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -Math.random() * 0.3 - 0.05,
            radius: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.25 + 0.05,
            color: ['#81C784', '#A1887F', '#FFD54F', '#D7CCC8'][Math.floor(Math.random() * 4)]
        };
    }

    function init() {
        resize();
        particles = Array.from({ length: COUNT }, createParticle);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
            if (p.x < -10) p.x = canvas.width + 10;
            if (p.x > canvas.width + 10) p.x = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    init();
    animate();
}

// ===========================
// Initialize
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
    await initLanguage();
    renderDrinkSelector();
    initForm();
    initWrapped();
    initNewAnalysis();
    initLanding();
    initParticles();
});
