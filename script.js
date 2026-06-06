// ─────────────────────────────────────────────────────────────
//  Orion Construções — Quiz + Meta CAPI tracking
//  Pixel ID : 1327948448428782
//  Estratégia: Pixel (client) + CAPI (server) deduplicados
//              via event_id único por evento
// ─────────────────────────────────────────────────────────────

const BACKEND   = 'https://orion-construtora-production.up.railway.app';
const PIXEL_ID  = '1327948448428782';
const PAGE_URL  = 'https://construtoraorion.com/';

// ── Estado global ──────────────────────────────────────────
let leadData = {
    hasTerrain : null,
    name       : '',
    phone      : '',
    incomeOk   : null,
    entryOk    : null,
    leadId     : null,    // ID Kommo
    externalId : null,    // external_id consistente (hash do telefone)
    eventIdLead: null,    // event_id do evento Lead (dedup pixel/CAPI)
};

// ── Utilitários ────────────────────────────────────────────

/** Gera UUID v4 para event_id de deduplicação */
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/** Lê cookie pelo nome */
function getCookie(name) {
    const v = ('; ' + document.cookie).split('; ' + name + '=');
    return v.length === 2 ? v.pop().split(';').shift() : null;
}

/** Remove acentos e retorna lowercase */
function normalizeStr(s) {
    return (s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim();
}

/** Normaliza telefone para E.164 sem o + (ex: 5592999999999) */
function normalizeTel(t) {
    let d = t.replace(/\D/g, '');
    if (!d.startsWith('55')) d = '55' + d;
    return d;
}

/** Captura UTMs do sessionStorage (gravados no index.html) */
function getUTMs() {
    const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
    const obj  = {};
    keys.forEach(k => { const v = sessionStorage.getItem(k); if (v) obj[k] = v; });
    return obj;
}

/** Dados do usuário para pixel (Meta hasheia client-side) */
function pixelUserData() {
    if (!leadData.phone) return {};
    const tel   = normalizeTel(leadData.phone);
    const parts = leadData.name.trim().split(' ');
    const fn    = normalizeStr(parts[0]);
    const ln    = normalizeStr(parts.slice(1).join(' ')) || fn;
    return {
        ph          : tel,
        fn          : fn,
        ln          : ln,
        external_id : leadData.externalId || tel,
        fbc         : getCookie('_fbc') || undefined,
        fbp         : getCookie('_fbp') || undefined,
    };
}

// ── Inicialização ──────────────────────────────────────────
updateProgress(15);

// Formatação do telefone enquanto digita
document.getElementById('lead-phone').addEventListener('input', function(e) {
    var x = e.target.value.replace(/\D/g,'').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
    e.target.value = !x[2] ? x[1] : '('+x[1]+') '+x[2]+(x[3]?'-'+x[3]:'');
});

// ViewContent ao visualizar a primeira pergunta
fbq('track', 'ViewContent', {
    content_name    : 'Quiz Qualificação Orion',
    content_category: 'Imóveis Alto Padrão',
    content_type    : 'product',
}, { eventID: uuid() });

// ── Progresso ─────────────────────────────────────────────
function updateProgress(pct) {
    document.getElementById('progress-bar').style.width = pct + '%';
}

// ── Seleção do Terreno ────────────────────────────────────
function selectTerrain(hasTerrain) {
    leadData.hasTerrain = hasTerrain;
    const btns = document.querySelectorAll('#step1 .btn-option');
    btns[0].classList.toggle('selected', hasTerrain === true);
    btns[1].classList.toggle('selected', hasTerrain === false);
    document.getElementById('lead-form').classList.remove('hidden');
    updateProgress(30);
}

// ── Transição entre etapas ────────────────────────────────
function nextStep(current, next) {
    if (current === 1) {
        const name  = document.getElementById('lead-name').value.trim();
        const phone = document.getElementById('lead-phone').value.trim();
        if (!name || phone.length < 14) {
            alert('Por favor, preencha seu nome e um número de WhatsApp válido.');
            return;
        }
        leadData.name  = name;
        leadData.phone = phone;
        updateProgress(55);

        // external_id = telefone normalizado (consistente entre sessões)
        leadData.externalId = normalizeTel(phone);

        // ── EVENTO: Lead (step 1 completo) ──────────────────
        const eidLead = uuid();
        leadData.eventIdLead = eidLead;

        // Reinicializa pixel COM advanced matching
        fbq('init', PIXEL_ID, pixelUserData());

        // Dispara Lead no pixel
        fbq('track', 'Lead', {
            content_name    : 'Quiz Orion — Dados Capturados',
            content_category: 'Imóveis',
            value           : 0,
            currency        : 'BRL',
        }, { eventID: eidLead });

        // Cria lead no Kommo + dispara CAPI Lead (server-side)
        iniciarLead(eidLead);
    }

    const cur  = document.getElementById(`step${current}`);
    const nxt  = document.getElementById(`step${next}`);
    cur.style.opacity   = '0';
    cur.style.transform = 'translateY(-15px)';
    setTimeout(() => {
        cur.classList.add('hidden');
        cur.classList.remove('active');
        nxt.classList.remove('hidden');
        setTimeout(() => {
            nxt.classList.add('active');
            nxt.style.opacity   = '1';
            nxt.style.transform = 'translateY(0)';
        }, 50);
    }, 500);
}

// ── Renda ─────────────────────────────────────────────────
function answerIncome(isOk) {
    leadData.incomeOk = isOk;
    if (!isOk) {
        updateProgress(100);
        enviarLead('DESQUALIFICADO');
        showResult('step-disqualified', 2);
    } else {
        // ── EVENTO: InitiateCheckout (avançou na qualificação) ──
        fbq('track', 'InitiateCheckout', {
            content_name: 'Quiz Orion — Renda Aprovada',
            currency    : 'BRL',
            value       : 0,
        }, { eventID: uuid() });

        updateProgress(80);
        nextStep(2, 3);
    }
}

// ── Entrada ───────────────────────────────────────────────
function answerEntry(isOk) {
    leadData.entryOk = isOk;
    updateProgress(100);
    const resultado = isOk ? 'QUALIFICADO' : 'DESQUALIFICADO';
    enviarLead(resultado);
    if (!isOk) {
        showResult('step-disqualified', 3);
    } else {
        showResult('step-success', 3);
    }
}

// ── Kommo: cria lead em "Acompanhar" + dispara CAPI Lead ──
function iniciarLead(eventId) {
    const utms = getUTMs();
    fetch(`${BACKEND}/lead/init`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            nome        : leadData.name,
            telefone    : leadData.phone,
            tem_terreno : leadData.hasTerrain,
            external_id : leadData.externalId,
            // CAPI dedup
            event_id    : eventId,
            event_source_url: PAGE_URL,
            fbc         : getCookie('_fbc') || '',
            fbp         : getCookie('_fbp') || '',
            user_agent  : navigator.userAgent,
            ...utms,
        }),
    })
    .then(r => r.json())
    .then(d => {
        if (d.lead_id) {
            leadData.leadId = d.lead_id;
        }
    })
    .catch(e => console.warn('iniciarLead erro:', e));
}

// ── Kommo: atualiza lead + dispara CAPI CompleteRegistration / desqualificado ──
function enviarLead(resultado) {
    const eventName = resultado === 'QUALIFICADO' ? 'CompleteRegistration' : 'Purchase';
    const eid       = uuid();

    // ── Pixel ──────────────────────────────────────────────
    if (resultado === 'QUALIFICADO') {
        fbq('track', 'CompleteRegistration', {
            content_name: 'Lead Qualificado — Orion',
            currency    : 'BRL',
            value       : 0,
            status      : true,
        }, { eventID: eid });
    } else {
        // Lead desqualificado — rastrear como evento customizado
        fbq('trackCustom', 'LeadDesqualificado', {
            content_name: 'Lead Desqualificado — Orion',
            renda_ok    : leadData.incomeOk,
            entrada_ok  : leadData.entryOk,
        }, { eventID: eid });
    }

    // ── Backend (Kommo + CAPI) ─────────────────────────────
    fetch(`${BACKEND}/lead/complete`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            lead_id     : leadData.leadId,
            nome        : leadData.name,
            telefone    : leadData.phone,
            tem_terreno : leadData.hasTerrain,
            renda_ok    : leadData.incomeOk,
            entrada_ok  : leadData.entryOk,
            resultado   : resultado,
            external_id : leadData.externalId,
            // CAPI
            capi_event_name: eventName,
            event_id    : eid,
            event_source_url: PAGE_URL,
            fbc         : getCookie('_fbc') || '',
            fbp         : getCookie('_fbp') || '',
            user_agent  : navigator.userAgent,
        }),
    })
    .then(r => r.json())
    .then(d => console.log('Lead completo:', d))
    .catch(e => console.warn('enviarLead erro:', e));
}

// ── Transição de resultado ────────────────────────────────
function showResult(resultId, currentStep) {
    const cur = document.getElementById(`step${currentStep}`);
    const res = document.getElementById(resultId);
    cur.style.opacity   = '0';
    cur.style.transform = 'translateY(-15px)';
    setTimeout(() => {
        cur.classList.add('hidden');
        cur.classList.remove('active');
        res.classList.remove('hidden');
        setTimeout(() => {
            res.classList.add('active');
            res.style.opacity   = '1';
            res.style.transform = 'translateY(0)';
        }, 50);
    }, 500);
}

// ── WhatsApp ──────────────────────────────────────────────
function redirectToWhatsApp() {
    // ── EVENTO: Contact (clique no botão WhatsApp) ─────────
    const eid = uuid();
    fbq('track', 'Contact', {
        content_name: 'WhatsApp Diretor — Orion',
    }, { eventID: eid });

    // CAPI Contact server-side
    fetch(`${BACKEND}/lead/capi`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            event_name  : 'Contact',
            event_id    : eid,
            lead_id     : leadData.leadId,
            nome        : leadData.name,
            telefone    : leadData.phone,
            external_id : leadData.externalId,
            event_source_url: PAGE_URL,
            fbc         : getCookie('_fbc') || '',
            fbp         : getCookie('_fbp') || '',
            user_agent  : navigator.userAgent,
        }),
    }).catch(() => {});

    const text  = encodeURIComponent(
        `Olá, diretor. Meu nome é ${leadData.name}. ` +
        `Concluí minha qualificação na página exclusiva e gostaria de agendar ` +
        `uma reunião sobre o meu novo projeto de alto padrão.`
    );
    const phone = '559293000306';
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
}
