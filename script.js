// ─────────────────────────────────────────────────────────────────────────────
//  Orion Construções — Quiz + Meta Pixel + CAPI (EMQ 9-10)
//  Pixel ID : 1327948448428782
//  Estratégia: Pixel client-side + CAPI server-side deduplicados via event_id
//  content_ids consistente: ['orion-alto-padrao']
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND    = 'https://orion-construtora-production.up.railway.app';
const PIXEL_ID   = '1327948448428782';
const PAGE_URL   = 'https://construtoraorion.com/';
const CONTENT_ID = 'orion-alto-padrao';   // content_id consistente em todos os eventos

// Valores realistas para aprendizado do algoritmo Meta
const VALUE_LEAD         = 1000;    // valor estimado de um lead (R$1.000)
const VALUE_QUALIFICADO  = 50000;   // entrada mínima do projeto (R$50.000)
const CURRENCY           = 'BRL';

// ── Estado global ──────────────────────────────────────────────────────────
let leadData = {
    hasTerrain : null,
    name       : '',
    phone      : '',
    email      : '',      // campo de maior peso no EMQ após phone
    incomeOk   : null,
    entryOk    : null,
    leadId     : null,    // ID Kommo
    externalId : null,    // external_id consistente (= telefone normalizado)
};

// ── Utilitários ────────────────────────────────────────────────────────────

/** UUID v4 — usado como event_id para deduplicação pixel ↔ CAPI */
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

/** Remove acentos + lowercase */
function normalizeStr(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Telefone → E.164 sem + (ex: 5592999999999) */
function normalizeTel(t) {
    let d = t.replace(/\D/g, '');
    return d.startsWith('55') ? d : '55' + d;
}

/** Email normalizado (lowercase, sem espaços) */
function normalizeEmail(e) {
    return (e || '').toLowerCase().trim();
}

/** UTMs do sessionStorage */
function getUTMs() {
    const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
    const obj  = {};
    keys.forEach(k => { const v = sessionStorage.getItem(k); if (v) obj[k] = v; });
    return obj;
}

/**
 * Dados avançados do usuário para o Pixel (Meta hasheia client-side).
 * Inclui email quando disponível — maior impacto no EMQ.
 */
function pixelUserData() {
    if (!leadData.phone) return {};
    const tel   = normalizeTel(leadData.phone);
    const parts = leadData.name.trim().split(' ');
    const fn    = normalizeStr(parts[0]);
    const ln    = normalizeStr(parts.slice(1).join(' ')) || fn;
    const ud    = {
        ph          : tel,
        fn          : fn,
        ln          : ln,
        external_id : leadData.externalId || tel,
        fbc         : getCookie('_fbc') || undefined,
        fbp         : getCookie('_fbp') || undefined,
    };
    if (leadData.email) ud.em = normalizeEmail(leadData.email);
    return ud;
}

/** Parâmetros custom_data padrão para todos os eventos */
function customData(extra = {}) {
    return {
        content_ids     : [CONTENT_ID],
        content_category: 'Imóveis Alto Padrão',
        currency        : CURRENCY,
        ...extra,
    };
}

// ── Inicialização ──────────────────────────────────────────────────────────
updateProgress(15);

// Formata telefone enquanto digita
document.getElementById('lead-phone').addEventListener('input', function(e) {
    var x = e.target.value.replace(/\D/g,'').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
    e.target.value = !x[2] ? x[1] : '('+x[1]+') '+x[2]+(x[3]?'-'+x[3]:'');
});

// ── ViewContent — usuário vê o quiz ──────────────────────────────────────
fbq('track', 'ViewContent', customData({
    content_name: 'Quiz Qualificação Orion Construtora',
    content_type: 'product',
    value       : 0,
}), { eventID: uuid() });

// ── Progresso ─────────────────────────────────────────────────────────────
function updateProgress(pct) {
    document.getElementById('progress-bar').style.width = pct + '%';
}

// ── Seleção do Terreno ────────────────────────────────────────────────────
function selectTerrain(hasTerrain) {
    leadData.hasTerrain = hasTerrain;
    const btns = document.querySelectorAll('#step1 .btn-option');
    btns[0].classList.toggle('selected', hasTerrain === true);
    btns[1].classList.toggle('selected', hasTerrain === false);
    document.getElementById('lead-form').classList.remove('hidden');
    updateProgress(30);
}

// ── Transição entre etapas ─────────────────────────────────────────────────
function nextStep(current, next) {
    if (current === 1) {
        const name  = document.getElementById('lead-name').value.trim();
        const phone = document.getElementById('lead-phone').value.trim();
        const email = document.getElementById('lead-email').value.trim();

        if (!name || phone.length < 14) {
            alert('Por favor, preencha seu nome e um número de WhatsApp válido.');
            return;
        }

        leadData.name       = name;
        leadData.phone      = phone;
        leadData.email      = email;
        leadData.externalId = normalizeTel(phone);   // external_id consistente

        updateProgress(55);

        // ── EVENTO: Lead ────────────────────────────────────────────────────
        // Reinicializa pixel com advanced matching completo (phone + email + name)
        fbq('init', PIXEL_ID, pixelUserData());

        const eidLead = uuid();
        fbq('track', 'Lead', customData({
            content_name: 'Quiz Orion — Dados Capturados',
            value       : VALUE_LEAD,
        }), { eventID: eidLead });

        // Backend: cria lead Kommo em "Acompanhar" + CAPI Lead server-side
        iniciarLead(eidLead);
    }

    const cur = document.getElementById(`step${current}`);
    const nxt = document.getElementById(`step${next}`);
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

// ── Pergunta: Renda ───────────────────────────────────────────────────────
function answerIncome(isOk) {
    leadData.incomeOk = isOk;
    if (!isOk) {
        updateProgress(100);
        // ── EVENTO: SubmitApplication (quiz concluído — desclassificado na renda)
        fbq('track', 'SubmitApplication', customData({
            content_name: 'Quiz Orion — Não Qualificado (Renda)',
            value       : 0,
        }), { eventID: uuid() });

        enviarLead('DESQUALIFICADO');
        showResult('step-disqualified', 2);
    } else {
        // ── EVENTO: InitiateCheckout — avançou para a última etapa
        fbq('track', 'InitiateCheckout', customData({
            content_name: 'Quiz Orion — Renda Aprovada',
            value       : VALUE_LEAD,
        }), { eventID: uuid() });

        updateProgress(80);
        nextStep(2, 3);
    }
}

// ── Pergunta: Entrada ─────────────────────────────────────────────────────
function answerEntry(isOk) {
    leadData.entryOk = isOk;
    updateProgress(100);
    const resultado = isOk ? 'QUALIFICADO' : 'DESQUALIFICADO';

    // ── EVENTO: SubmitApplication — quiz 100% concluído
    fbq('track', 'SubmitApplication', customData({
        content_name: `Quiz Orion — ${resultado}`,
        value       : isOk ? VALUE_QUALIFICADO : 0,
    }), { eventID: uuid() });

    enviarLead(resultado);
    showResult(isOk ? 'step-success' : 'step-disqualified', 3);
}

// ── Kommo: cria lead em "Acompanhar" + CAPI Lead ─────────────────────────
function iniciarLead(eventId) {
    fetch(`${BACKEND}/lead/init`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            nome        : leadData.name,
            telefone    : leadData.phone,
            email       : leadData.email,
            tem_terreno : leadData.hasTerrain,
            external_id : leadData.externalId,
            event_id    : eventId,
            event_source_url: PAGE_URL,
            fbc         : getCookie('_fbc') || '',
            fbp         : getCookie('_fbp') || '',
            user_agent  : navigator.userAgent,
            value       : VALUE_LEAD,
            currency    : CURRENCY,
            content_ids : [CONTENT_ID],
            ...getUTMs(),
        }),
    })
    .then(r => r.json())
    .then(d => { if (d.lead_id) leadData.leadId = d.lead_id; })
    .catch(e => console.warn('iniciarLead erro:', e));
}

// ── Kommo: atualiza lead + CAPI CompleteRegistration / desqualificado ─────
function enviarLead(resultado) {
    const eid        = uuid();
    const isQual     = resultado === 'QUALIFICADO';
    const eventName  = isQual ? 'CompleteRegistration' : 'LeadDesqualificado';
    const valor      = isQual ? VALUE_QUALIFICADO : 0;

    // ── Pixel ─────────────────────────────────────────────────────────────
    if (isQual) {
        fbq('track', 'CompleteRegistration', customData({
            content_name: 'Lead Qualificado — Orion Construtora',
            value       : valor,
            status      : true,
        }), { eventID: eid });
    } else {
        fbq('trackCustom', 'LeadDesqualificado', customData({
            content_name: 'Lead Desqualificado — Orion',
            renda_ok    : leadData.incomeOk,
            entrada_ok  : leadData.entryOk,
            value       : 0,
        }), { eventID: eid });
    }

    // ── Backend: Kommo + CAPI ─────────────────────────────────────────────
    fetch(`${BACKEND}/lead/complete`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            lead_id          : leadData.leadId,
            nome             : leadData.name,
            telefone         : leadData.phone,
            email            : leadData.email,
            tem_terreno      : leadData.hasTerrain,
            renda_ok         : leadData.incomeOk,
            entrada_ok       : leadData.entryOk,
            resultado        : resultado,
            external_id      : leadData.externalId,
            capi_event_name  : eventName,
            event_id         : eid,
            event_source_url : PAGE_URL,
            fbc              : getCookie('_fbc') || '',
            fbp              : getCookie('_fbp') || '',
            user_agent       : navigator.userAgent,
            value            : valor,
            currency         : CURRENCY,
            content_ids      : [CONTENT_ID],
        }),
    })
    .then(r => r.json())
    .then(d => console.log('Lead completo:', d))
    .catch(e => console.warn('enviarLead erro:', e));
}

// ── Transição de resultado ────────────────────────────────────────────────
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

// ── Clique no WhatsApp ────────────────────────────────────────────────────
function redirectToWhatsApp() {
    const eid = uuid();

    // ── EVENTO: Contact (pixel) ───────────────────────────────────────────
    fbq('track', 'Contact', customData({
        content_name: 'WhatsApp Diretor — Orion Construtora',
        value       : VALUE_QUALIFICADO,
    }), { eventID: eid });

    // ── CAPI Contact (server-side) ────────────────────────────────────────
    fetch(`${BACKEND}/lead/capi`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            event_name       : 'Contact',
            event_id         : eid,
            lead_id          : leadData.leadId,
            nome             : leadData.name,
            telefone         : leadData.phone,
            email            : leadData.email,
            external_id      : leadData.externalId,
            event_source_url : PAGE_URL,
            fbc              : getCookie('_fbc') || '',
            fbp              : getCookie('_fbp') || '',
            user_agent       : navigator.userAgent,
            value            : VALUE_QUALIFICADO,
            currency         : CURRENCY,
            content_ids      : [CONTENT_ID],
        }),
    }).catch(() => {});

    // Abre WhatsApp
    const text  = encodeURIComponent(
        `Olá, diretor. Meu nome é ${leadData.name}. ` +
        `Concluí minha qualificação na página exclusiva e gostaria de agendar ` +
        `uma reunião sobre o meu novo projeto de alto padrão.`
    );
    window.open(`https://api.whatsapp.com/send?phone=559293000306&text=${text}`, '_blank');
}
