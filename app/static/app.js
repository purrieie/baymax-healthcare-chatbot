// ── Tab switching ──────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.getElementById(`nav-${name}`).classList.add('active');
    if (name === 'dashboard') setTimeout(loadInsights, 300);
}

// ── Markdown helper ────────────────────────────────────────
function renderMarkdown(text) {
    return text
        .replace(/\s*\(PMID:?\s*[\w\s,]+\)/gi, '')
        .replace(/\s*\[PMID:?\s*[\w\s,]+\]/gi, '')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\* (.+)/g, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

// ── Chat ──────────────────────────────────────────────────
const chatBox = document.getElementById('chatBox');
const input = document.getElementById('questionInput');
const btn = document.getElementById('sendBtn');

input.addEventListener('keydown', e => { if (e.key === 'Enter') sendQuestion(); });

function baymaxAvatar() {
    return `<div class="baymax-logo small"><div class="baymax-face"><div class="baymax-eyes"></div></div></div>`;
}

async function sendQuestion() {
    const question = input.value.trim();
    if (!question) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.innerHTML = `<div class="bubble">${question}</div>`;
    chatBox.appendChild(userMsg);
    input.value = '';
    btn.disabled = true;

    const loading = document.createElement('div');
    loading.className = 'message assistant';
    loading.innerHTML = `${baymaxAvatar()}<div class="loading">thinking</div>`;
    chatBox.appendChild(loading);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();
        chatBox.removeChild(loading);
        appendAssistantMessage(data);
    } catch {
        chatBox.removeChild(loading);
        const errMsg = document.createElement('div');
        errMsg.className = 'message assistant';
        errMsg.innerHTML = `${baymaxAvatar()}<div class="bubble">Something went wrong. Please try again.</div>`;
        chatBox.appendChild(errMsg);
    }
    btn.disabled = false;
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendAssistantMessage(data) {
    const msg = document.createElement('div');
    msg.className = 'message assistant';

    const formatted = renderMarkdown(data.answer);

    let sourcesHtml = '';
    if (data.chunks && data.chunks.length > 0) {
        const chunksHtml = data.chunks.map(c => {
            const score = Math.max(0, Math.min(1, c.score));
            const percent = Math.round(score * 100);
            const color = percent > 60 ? '#22c55e' : percent > 30 ? '#f59e0b' : '#94a3b8';
            return `
            <div class="chunk">
                <div class="chunk-header">
                    <span>${c.pmid}</span>
                    <div class="confidence">
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width:${percent}%;background:${color}"></div>
                        </div>
                        <span class="confidence-label">${percent}% match</span>
                    </div>
                </div>
                <p>${c.text}...</p>
            </div>`;
        }).join('');

        sourcesHtml = `
        <details class="sources-detail">
            <summary>View retrieved sources</summary>
            <div class="chunks">${chunksHtml}</div>
        </details>`;
    }

    msg.innerHTML = `
        ${baymaxAvatar()}
        <div class="bubble">
            <div class="answer-text">${formatted}</div>
            ${sourcesHtml}
        </div>`;
    chatBox.appendChild(msg);

    const chartData = extractChartData(data.answer);
    if (chartData) {
        const chartMsg = document.createElement('div');
        chartMsg.className = 'message assistant chart-message';
        const canvasId = `chart-${Date.now()}`;
        chartMsg.innerHTML = `
            ${baymaxAvatar()}
            <div class="chart-card">
                <div class="chart-label">DATA VISUALIZATION</div>
                <canvas id="${canvasId}" height="180"></canvas>
            </div>`;
        chatBox.appendChild(chartMsg);

        setTimeout(() => {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            new Chart(ctx, {
                type: chartData.type,
                data: chartData.data,
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: chartData.data.datasets.length > 1 },
                        tooltip: { enabled: true }
                    },
                    scales: chartData.type === 'bar' || chartData.type === 'line' ? {
                        y: { beginAtZero: true, grid: { color: '#f0f4ff' } },
                        x: { grid: { display: false } }
                    } : {}
                }
            });
        }, 50);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

// ── Chart extraction ───────────────────────────────────────
function extractChartData(text) {
    const percentMatches = [...text.matchAll(/([A-Za-z][A-Za-z\s]{2,30})[\s:]+(\d+(?:\.\d+)?)\s*%/g)];
    if (percentMatches.length >= 2) {
        const labels = percentMatches.map(m => m[1].trim().slice(0, 30));
        const values = percentMatches.map(m => parseFloat(m[2]));
        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Percentage (%)',
                    data: values,
                    backgroundColor: labels.map((_, i) =>
                        ['#93c5fd','#6ee7b7','#fca5a5','#c4b5fd','#fdba74','#a5f3fc'][i % 6]
                    ),
                    borderRadius: 8,
                    borderSkipped: false
                }]
            }
        };
    }

    const colonMatches = [...text.matchAll(/([A-Za-z][A-Za-z\s]{1,25}):\s*(\d+(?:\.\d+)?)\b(?!\s*%)/g)];
    const filtered = colonMatches.filter(m => {
        const num = parseFloat(m[2]);
        return num > 1 && num < 100000;
    });
    if (filtered.length >= 3) {
        const labels = filtered.slice(0, 6).map(m => m[1].trim().slice(0, 25));
        const values = filtered.slice(0, 6).map(m => parseFloat(m[2]));
        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Values',
                    data: values,
                    backgroundColor: labels.map((_, i) =>
                        ['#93c5fd','#6ee7b7','#fca5a5','#c4b5fd','#fdba74','#a5f3fc'][i % 6]
                    ),
                    borderRadius: 8,
                    borderSkipped: false
                }]
            }
        };
    }

    return null;
}

// ── Symptom Checker ───────────────────────────────────────
let symptoms = [];
let selectedRegion = 'General';

function selectRegion(region) {
    document.querySelectorAll('.body-part').forEach(p => p.classList.remove('selected'));
    document.querySelectorAll(`[data-region="${region}"]`).forEach(p => p.classList.add('selected'));
    selectedRegion = region.charAt(0).toUpperCase() + region.slice(1);
    const label = document.getElementById('regionLabel');
    if (label) label.textContent = `Selected: ${selectedRegion}`;
}

function addSymptom() {
    const inp = document.getElementById('symptomInput');
    const val = inp.value.trim();
    if (!val) return;
    symptoms.push({ region: selectedRegion, symptom: val });
    renderTags();
    inp.value = '';
}

function renderTags() {
    const container = document.getElementById('symptomTags');
    container.innerHTML = symptoms.map((s, i) => `
        <div class="symptom-tag">
            <span>${s.symptom} (${s.region})</span>
            <button onclick="removeSymptom(${i})">×</button>
        </div>`).join('');
}

function removeSymptom(i) {
    symptoms.splice(i, 1);
    renderTags();
}

async function analyzeSymptoms() {
    if (symptoms.length === 0) return;
    const btn = document.getElementById('analyzeBtn');
    const resultCard = document.getElementById('symptomResult');
    const resultContent = document.getElementById('resultContent');

    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    const symptomText = symptoms.map(s => `${s.symptom} in ${s.region}`).join(', ');
    const question = `Patient symptoms: ${symptomText}.

List exactly 3 possible conditions. Use EXACTLY this format for each:

1. Condition Name
Severity: mild
Explanation: One sentence about why this matches the symptoms.

2. Condition Name
Severity: moderate
Explanation: One sentence about why this matches the symptoms.

3. Condition Name
Severity: serious
Explanation: One sentence about why this matches the symptoms.

Do not add any intro text, bullet points, PMIDs, or extra formatting.`;

    try {
        const res = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();

        let html = parseConditions(data.answer);
        html += `<div class="disclaimer-box">This is for informational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.</div>`;

        resultContent.innerHTML = html;
        resultCard.style.display = 'block';
    } catch {
        resultContent.innerHTML = '<p>Analysis failed. Please try again.</p>';
        resultCard.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Generate Full Report';
}

function parseConditions(text) {
    text = text.replace(/\s*\(PMID:?\s*[\w\s,]+\)/gi, '');

    const blocks = text.trim().split(/\n{1,2}(?=\d+\.)/).filter(b => b.trim());
    let html = '';

    blocks.forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;

        const name = lines[0].replace(/^\d+\.\s*/, '').trim();

        const severityLine = lines.find(l => /severity/i.test(l)) || '';
        const severityMatch = severityLine.match(/severity[:\s]*(mild|moderate|serious)/i);
        const severity = severityMatch ? severityMatch[1].toLowerCase() : '';

        const explLine = lines.find(l => /explanation[:\s]/i.test(l)) || '';
        const explanation = explLine.replace(/^explanation[:\s]*/i, '').trim();

        if (!name) return;

        html += `
        <div class="condition-card">
            <div class="condition-header">
                <span class="condition-name">${name}</span>
                ${severity ? `<span class="severity ${severity}">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span>` : ''}
            </div>
            ${explanation ? `<p class="condition-desc">${explanation}</p>` : ''}
        </div>`;
    });

    return html || `<p style="font-size:14px;color:#475569;">${text}</p>`;
}

// ── Report Scanner ────────────────────────────────────────
async function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const result = document.getElementById('reportResult');
    const reader = new FileReader();

    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        result.style.display = 'block';
        result.innerHTML = '<div class="loading">Analyzing your report</div>';

        try {
            const res = await fetch('/scan-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, data: base64, type: file.type })
            });
            const data = await res.json();

            const abnormalCount = (data.analysis.match(/ABNORMAL/g) || []).length;
            const normalCount = (data.analysis.match(/(?<!AB)NORMAL/g) || []).length;
            const total = abnormalCount + normalCount;

            const summaryHtml = `
            <div style="background:white;border:1px solid #e8edf5;border-radius:20px;padding:24px;margin-bottom:16px;display:flex;align-items:center;gap:32px;">
                <div style="flex:1;">
                    <div style="font-size:11px;font-weight:700;color:#3b82f6;letter-spacing:0.08em;margin-bottom:8px;">REPORT SUMMARY</div>
                    <div style="font-size:28px;font-weight:800;color:#1e293b;letter-spacing:-1px;">${total} Parameters</div>
                    <div style="display:flex;gap:16px;margin-top:12px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div style="width:10px;height:10px;border-radius:50%;background:#22c55e;"></div>
                            <span style="font-size:13px;color:#475569;">${normalCount} Normal</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;"></div>
                            <span style="font-size:13px;color:#475569;">${abnormalCount} Abnormal</span>
                        </div>
                    </div>
                </div>
                <div style="position:relative;width:110px;height:110px;flex-shrink:0;">
                    <canvas id="reportDonut"></canvas>
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                        <div style="font-size:22px;font-weight:800;color:#ef4444;">${abnormalCount}</div>
                        <div style="font-size:10px;color:#94a3b8;">flagged</div>
                    </div>
                </div>
            </div>`;

            result.innerHTML = summaryHtml + renderReportCards(data.analysis);

            setTimeout(() => {
                const ctx = document.getElementById('reportDonut');
                if (!ctx) return;
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [abnormalCount, normalCount],
                            backgroundColor: ['#fca5a5', '#86efac'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        cutout: '72%',
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        animation: { duration: 800 }
                    }
                });
            }, 50);

        } catch {
            result.innerHTML = 'Could not analyze. Please try again.';
        }
    };
    reader.readAsDataURL(file);
}

function renderReportCards(text) {
    const lines = text.split('\n').filter(l => l.trim());
    let html = '<div style="display:flex;flex-direction:column;gap:12px;">';
    let currentParam = null;

    lines.forEach(line => {
        const paramMatch = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?:\s*(.+)/);
        if (paramMatch) {
            if (currentParam) html += '</div></div>';
            currentParam = paramMatch[1];
            html += `
            <div style="background:white;border:1px solid #e8edf5;border-radius:14px;padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:700;font-size:14px;color:#1e293b;">${paramMatch[1]}</span>
                    <span style="font-size:13px;color:#64748b;">${paramMatch[2]}</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;">`;
        } else if (line.includes('ABNORMAL')) {
            html += `<div style="display:flex;gap:8px;align-items:flex-start;">
                <span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;flex-shrink:0;margin-top:2px;">ABNORMAL</span>
                <span style="font-size:13px;color:#475569;">${line.replace(/.*ABNORMAL[:\s]*/i,'')}</span>
            </div>`;
        } else if (line.includes('NORMAL')) {
            html += `<div style="display:flex;gap:8px;align-items:flex-start;">
                <span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;flex-shrink:0;margin-top:2px;">NORMAL</span>
                <span style="font-size:13px;color:#475569;">${line.replace(/.*NORMAL[:\s]*/i,'')}</span>
            </div>`;
        } else if (line.toLowerCase().includes('recommendation')) {
            html += `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">${line.replace(/^-\s*/,'')}</div>`;
        }
    });

    if (currentParam) html += '</div></div>';
    html += '</div>';
    html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 16px;font-size:12px;color:#92400e;margin-top:8px;line-height:1.6;">
        This analysis is for informational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.
    </div>`;

    return html;
}

// ── Dashboard Insights ────────────────────────────────────
async function loadInsights() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch('/insights', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        data.insights.forEach((item, i) => {
            const idx = i + 1;
            const topicEl = document.getElementById(`insightTopic${idx}`);
            const textEl = document.getElementById(`insightText${idx}`);
            if (!topicEl || !textEl) return;
            topicEl.textContent = item.topic;
            textEl.innerHTML = item.insight
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\* .+/g, '')
                .replace(/\n/g, ' ')
                .trim();
        });
    } catch(e) {
        console.error('Insights failed', e);
        ['1','2','3'].forEach(i => {
            const el = document.getElementById(`insightText${i}`);
            if (el) el.innerHTML = 'Check back in a moment.';
        });
    }
}

// ── Dashboard Question ────────────────────────────────────
async function askDashQuestion() {
    const q = document.getElementById('dashQuestion').value.trim();
    if (!q) return;
    const answerEl = document.getElementById('dashAnswer');
    answerEl.style.display = 'block';
    answerEl.innerHTML = '<div class="loading">thinking</div>';
    try {
        const res = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q })
        });
        const data = await res.json();
        answerEl.innerHTML = data.answer
            .replace(/\s*\(PMID:?\s*[\w\s,]+\)/gi, '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    } catch {
        answerEl.innerHTML = 'Something went wrong. Please try again.';
    }
}

// ── Sleep ─────────────────────────────────────────────────
function calculateSleep() {
    const sleep = document.getElementById('sleepTime').value;
    const wake = document.getElementById('wakeTime').value;
    if (!sleep || !wake) return;

    const [sh, sm] = sleep.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);

    let sleepMins = sh * 60 + sm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= sleepMins) wakeMins += 24 * 60;
    const totalMins = wakeMins - sleepMins;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    const quality = totalMins >= 480 ? 'Great' : totalMins >= 420 ? 'Good' : totalMins >= 360 ? 'Fair' : 'Low';

    document.getElementById('sleepDuration').textContent = `${hrs}h ${mins}m`;
    document.getElementById('sleepQualityLabel').textContent = quality;
    document.getElementById('sleepInputState').style.display = 'none';
    document.getElementById('sleepResultState').style.display = 'block';
    document.getElementById('sleepMeta').textContent = `${sleep} – ${wake}`;

    drawSleepArc(sleepMins, wakeMins);
}

function resetSleep() {
    document.getElementById('sleepInputState').style.display = 'block';
    document.getElementById('sleepResultState').style.display = 'none';
    document.getElementById('sleepMeta').textContent = 'Last Night';
}

function drawSleepArc(sleepMins, wakeMins) {
    const sleep = document.getElementById('sleepTime').value;
    const wake = document.getElementById('wakeTime').value;
    document.getElementById('sleepTimeLeft').textContent = sleep;
    document.getElementById('sleepTimeRight').textContent = wake;
}

// ── Auto-load insights on page open ──────────────────────
setTimeout(loadInsights, 500);