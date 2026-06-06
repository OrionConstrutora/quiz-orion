const BACKEND = 'https://orion-construtora-production.up.railway.app';

let leadData = {
    hasTerrain: null,
    name: '',
    phone: '',
    incomeOk: null,
    entryOk: null,
    leadId: null,      // ID do lead criado no Kommo
};


// Start progress at 15% (Initial Step)
updateProgress(15);

// Formatação do Telefone enquanto digita
document.getElementById('lead-phone').addEventListener('input', function (e) {
    var x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
    e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
});

// Atualizar Barra de Progresso
function updateProgress(percentage) {
    document.getElementById('progress-bar').style.width = percentage + '%';
}

// Seleção do Terreno
function selectTerrain(hasTerrain) {
    leadData.hasTerrain = hasTerrain;
    
    // Highlight do botão selecionado
    const buttons = document.querySelectorAll('#step1 .btn-option');
    buttons[0].classList.toggle('selected', hasTerrain === true);
    buttons[1].classList.toggle('selected', hasTerrain === false);

    // Exibe o formulário de captura suavemente
    const form = document.getElementById('lead-form');
    form.classList.remove('hidden');
    updateProgress(30);
}

// Transição fluida entre etapas
function nextStep(current, next) {
    if(current === 1) {
        const nameInput = document.getElementById('lead-name').value.trim();
        const phoneInput = document.getElementById('lead-phone').value.trim();

        if(!nameInput || phoneInput.length < 14) {
            alert('Por favor, preencha seu nome e um número de WhatsApp válido.');
            return;
        }
        leadData.name = nameInput;
        leadData.phone = phoneInput;
        updateProgress(55);

        // Cria lead em "Acompanhar" imediatamente
        iniciarLead();
    }

    const currentEl = document.getElementById(`step${current}`);
    const nextEl = document.getElementById(`step${next}`);

    // Fade Out
    currentEl.style.opacity = '0';
    currentEl.style.transform = 'translateY(-15px)';
    
    setTimeout(() => {
        currentEl.classList.add('hidden');
        currentEl.classList.remove('active');
        
        nextEl.classList.remove('hidden');
        
        // Timeout para garantir que o display:block aplicou antes de animar
        setTimeout(() => {
            nextEl.classList.add('active');
            nextEl.style.opacity = '1';
            nextEl.style.transform = 'translateY(0)';
        }, 50);
    }, 500); 
}

function answerIncome(isOk) {
    leadData.incomeOk = isOk;
    if(!isOk) {
        updateProgress(100);
        enviarLead('DESQUALIFICADO');
        showResult('step-disqualified', 2);
    } else {
        updateProgress(80);
        nextStep(2, 3);
    }
}

function answerEntry(isOk) {
    leadData.entryOk = isOk;
    updateProgress(100);
    const resultado = isOk ? 'QUALIFICADO' : 'DESQUALIFICADO';
    enviarLead(resultado);
    if(!isOk) {
        showResult('step-disqualified', 3);
    } else {
        showResult('step-success', 3);
    }
}

// 1. Cria lead em "Acompanhar" ao preencher nome+telefone
function iniciarLead() {
    fetch(`${BACKEND}/lead/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome:        leadData.name,
            telefone:    leadData.phone,
            tem_terreno: leadData.hasTerrain,
        })
    })
    .then(r => r.json())
    .then(d => {
        if(d.lead_id) {
            leadData.leadId = d.lead_id;
            console.log('Lead iniciado:', d.lead_id);
        }
    })
    .catch(e => console.warn('Erro ao iniciar lead:', e));
}

// 2. Atualiza lead com resultado final (Qualificado ou Perdido)
function enviarLead(resultado) {
    fetch(`${BACKEND}/lead/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            lead_id:     leadData.leadId,
            nome:        leadData.name,
            telefone:    leadData.phone,
            tem_terreno: leadData.hasTerrain,
            renda_ok:    leadData.incomeOk,
            entrada_ok:  leadData.entryOk,
            resultado:   resultado,
        })
    })
    .then(r => r.json())
    .then(d => console.log('Lead concluído:', d))
    .catch(e => console.warn('Erro ao concluir lead:', e));
}

function showResult(resultId, currentStep) {
    const currentEl = document.getElementById(`step${currentStep}`);
    const resultEl = document.getElementById(resultId);

    currentEl.style.opacity = '0';
    currentEl.style.transform = 'translateY(-15px)';
    
    setTimeout(() => {
        currentEl.classList.add('hidden');
        currentEl.classList.remove('active');
        
        resultEl.classList.remove('hidden');
        
        setTimeout(() => {
            resultEl.classList.add('active');
            resultEl.style.opacity = '1';
            resultEl.style.transform = 'translateY(0)';
        }, 50);
    }, 500);
}

function redirectToWhatsApp() {
    const text = encodeURIComponent(`Olá, diretor. Meu nome é ${leadData.name}. Concluí minha qualificação na página exclusiva e gostaria de agendar uma reunião sobre o meu novo projeto de alto padrão.`);
    const phone = '559293000306';
    window.location.href = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;
}
