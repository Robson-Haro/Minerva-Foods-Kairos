# Kairos · Gestão de Talentos — Minerva Foods

Sistema de mobilidade interna e ranqueamento de compatibilidade de talentos.
*Momento certo · Tempo oportuno.*

App **estático** de arquivo único (`index.html`): React inline, SheetJS embutido para ler `.xlsx`, leitura nativa de `.csv`, tema glass sobre o azul Minerva. Roda offline abrindo o arquivo no navegador e também hospedado como site estático.

> **Fase 1 (atual):** tudo roda no navegador; os dados ficam no `localStorage`. As credenciais de integração (Gupy, SendGrid, Twilio, Anthropic, Supabase) descrevem só a estrutura — as chamadas reais às APIs são da Fase 2 (backend), nunca pelo navegador.

---

## Estrutura

```
kairos-minervafoods/
├── index.html     ← o app (arquivo único, autocontido)
├── vercel.json    ← serve o index.html em qualquer rota
├── .gitignore
└── README.md
```

---

## Subir no GitHub

### Opção A — linha de comando

```bash
cd kairos-minervafoods
git init
git add .
git commit -m "Kairos · primeira versão"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/kairos-minervafoods.git
git push -u origin main
```

(Crie o repositório vazio em https://github.com/new antes — **sem** README, pra não dar conflito.)

### Opção B — sem terminal

1. Crie o repositório em https://github.com/new
2. Na página do repo, clique em **"uploading an existing file"**
3. Arraste `index.html`, `vercel.json`, `.gitignore` e `README.md`
4. **Commit changes**

---

## Deploy na Vercel

1. Acesse https://vercel.com e faça login com o GitHub
2. **Add New → Project** e importe o repositório `kairos-minervafoods`
3. Em **Framework Preset**, deixe **Other** (é site estático, sem build)
4. Deixe **Build Command** e **Output Directory** em branco (a raiz já tem o `index.html`)
5. **Deploy**

Pronto: a Vercel publica em `https://kairos-minervafoods.vercel.app` (ou o nome que você escolher). Todo novo `git push` na branch `main` redeploya automático.

---

## Como usar o app

1. **Upload** — suba a planilha de *Talentos Minerva*, a de *Vagas* (export Gupy) e, opcional, o catálogo de *Perfis de Cargo*.
2. **Análise** — clique em **Analisar**; o agente cruza perfis x vagas.
3. **Painel** — KPIs e indicações nas lentes *Por vaga* / *Por colaborador*.
4. **Configurações** — corte de score, máx. de convites, pesos e LGPD.

### Regra de hierarquia
Um colaborador só é indicado para vaga **1 ou 2 níveis acima** do cargo atual. Régua:

`Assistente → Analista Junior → Analista Pleno → Analista Sênior → Especialista → Supervisor → Coordenador → Gerente → Gerente Executivo → Diretor`

---

## Fase 2 (backend)
Integração real com Gupy (vagas), SendGrid (e-mail), Twilio (WhatsApp), Anthropic (personalização/explicabilidade) e Supabase (banco/export). As chamadas às APIs ficam fora do navegador.
