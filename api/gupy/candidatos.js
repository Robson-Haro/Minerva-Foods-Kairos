// Kairos · Importa candidatos (candidaturas) dos bancos internos da Gupy (jobIds = códigos dos bancos).
const BASE = "https://api.gupy.io/api/v1";
function limpa(s){ return String(s==null?"":s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }
module.exports = async (req, res) => {
  res.setHeader("Cache-Control","no-store");
  const token = process.env.GUPY_TOKEN;
  if(!token){ res.status(500).json({ok:false,erro:"GUPY_TOKEN não configurado na Vercel."}); return; }
  const ids = String((req.query&&req.query.jobIds)||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,40);
  if(!ids.length){ res.status(400).json({ok:false,erro:"Informe jobIds (códigos dos bancos)."}); return; }
  const candidatos=[]; const avisos=[];
  try{
    for(const jobId of ids){
      for(let page=1; page<=10; page++){
        const url = BASE+"/jobs/"+encodeURIComponent(jobId)+"/applications?fields=all&perPage=100&page="+page;
        const r = await fetch(url,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
        if(r.status===401){ res.status(401).json({ok:false,erro:"Token da Gupy inválido ou expirado (401)."}); return; }
        if(r.status===403){ res.status(403).json({ok:false,erro:"Token sem permissão para ler candidaturas (403). Habilite os endpoints de applications no token."}); return; }
        if(r.status===404){ avisos.push("Banco "+jobId+" não encontrado (404)."); break; }
        if(!r.ok){ avisos.push("Banco "+jobId+": Gupy respondeu "+r.status+"."); break; }
        const j = await r.json().catch(()=>null);
        const lista = Array.isArray(j)?j:((j&&(j.results||j.data))||[]);
        for(const a of lista){
          const c = a.candidate||a.candidato||a;
          const arr=x=>Array.isArray(x)?x:[];
          const exps=[...arr(c&&c.professionalExperiences),...arr(c&&c.experiences),...arr(a.professionalExperiences)]
            .map(e=>limpa([e&&(e.role||e.position||e.title||e.jobTitle), e&&(e.company||e.institution||e.employer), e&&(e.description||e.activities||e.summary)].filter(Boolean).join(" — "))).filter(Boolean);
          const forms=[...arr(c&&c.formations),...arr(c&&c.educations),...arr(c&&c.academicFormations)]
            .map(e=>limpa([e&&(e.course||e.name||e.title), e&&(e.institution||e.school)].filter(Boolean).join(" — "))).filter(Boolean);
          const skills=[...arr(c&&c.skills),...arr(c&&c.abilities)].map(x=>limpa(typeof x==="string"?x:(x&&(x.name||x.title))||"")).filter(Boolean);
          const idiomas=[...arr(c&&c.languages)].map(x=>limpa(typeof x==="string"?x:[x&&x.language,x&&x.level].filter(Boolean).join(" "))).filter(Boolean);
          const cargoAtual=limpa((c&&(c.currentJob||c.jobTitle||c.currentPosition))||"") || (exps.length?limpa(String(exps[0]).split(" — ")[0]):"");
          candidatos.push({
            bancoCodigo: String(jobId),
            applicationId: a.id||null,
            gupyCandidateId: (c&&(c.id||c.candidateId))||a.candidateId||null,
            nome: limpa([c&&c.name, c&&c.lastName].filter(Boolean).join(" ")) || limpa(a.name),
            email: (c&&(c.email||c.emailAddress))||a.email||"",
            telefone: (c&&(c.mobileNumber||c.phoneNumber||c.phone))||"",
            cargo: cargoAtual,
            experiencias: exps.slice(0,12),
            formacoes: forms.slice(0,8),
            skills: skills.slice(0,25),
            idiomas: idiomas.slice(0,6),
            resumo: limpa((c&&(c.summary||c.about||c.objective))||"")
          });
        }
        if(!Array.isArray(lista) || lista.length<100) break;
      }
    }
    res.status(200).json({ok:true,total:candidatos.length,candidatos,avisos});
  }catch(e){
    res.status(502).json({ok:false,erro:"Falha ao falar com a Gupy: "+(e&&e.message?e.message:"erro de rede"),avisos});
  }
};
