const BASE = "https://api.gupy.io/api/v1";
function limpa(s){ return String(s==null?"":s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }
function arr(x){ return Array.isArray(x)?x:[]; }
function extrai(a){
  const c = a.candidate||a.candidato||a;
  const exps=[...arr(c&&c.professionalExperiences),...arr(c&&c.experiences),...arr(a.professionalExperiences),...arr(a.experiences)]
    .map(e=>limpa([e&&(e.role||e.position||e.title||e.jobTitle), e&&(e.company||e.institution||e.employer), e&&(e.description||e.activities||e.summary)].filter(Boolean).join(" — "))).filter(Boolean);
  const forms=[...arr(c&&c.formations),...arr(c&&c.educations),...arr(c&&c.academicFormations),...arr(a.formations)]
    .map(e=>limpa([e&&(e.course||e.name||e.title), e&&(e.institution||e.school)].filter(Boolean).join(" — "))).filter(Boolean);
  const skills=[...arr(c&&c.skills),...arr(c&&c.abilities),...arr(a.skills)].map(x=>limpa(typeof x==="string"?x:(x&&(x.name||x.title))||"")).filter(Boolean);
  const idiomas=[...arr(c&&c.languages),...arr(a.languages)].map(x=>limpa(typeof x==="string"?x:[x&&x.language,x&&x.level].filter(Boolean).join(" "))).filter(Boolean);
  const cargo=limpa((c&&(c.currentJob||c.jobTitle||c.currentPosition))||"") || (exps.length?limpa(String(exps[0]).split(" — ")[0]):"");
  const resumo=limpa((c&&(c.summary||c.about||c.objective))||(a.summary||""));
  return {c, exps, forms, skills, idiomas, cargo, resumo,
    rico: (exps.length+forms.length+skills.length)>0 || resumo.length>=40 };
}
module.exports = async (req, res) => {
  res.setHeader("Cache-Control","no-store");
  const token = process.env.GUPY_TOKEN;
  if(!token){ res.status(500).json({ok:false,erro:"GUPY_TOKEN não configurado na Vercel."}); return; }
  const H={Authorization:"Bearer "+token,Accept:"application/json"};
  const ids = String((req.query&&req.query.jobIds)||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,40);
  if(!ids.length){ res.status(400).json({ok:false,erro:"Informe jobIds (códigos dos bancos)."}); return; }
  const INATIVOS=["reproved","disqualified","withdrawn","canceled","cancelled","rejected","declined","desist"];
  const incluirInativos=String((req.query&&req.query.incluirInativos)||"")==="1";
  const candidatos=[]; const avisos=[]; const vistos=new Set();
  let totalApi=0, inativas=0, duplicadas=0, detalheOk=0, detalheFalha=0;
  async function detalhe(jobId, appId){
    const urls=[BASE+"/jobs/"+jobId+"/applications/"+appId, BASE+"/applications/"+appId];
    for(const url of urls){
      try{
        const r=await fetch(url,{headers:H});
        if(r.ok){ const j=await r.json().catch(()=>null); if(j) return j.results||j.data||j; }
      }catch(e){}
    }
    return null;
  }
  try{
    for(const jobId of ids){
      const brutos=[];
      for(let page=1; page<=10; page++){
        const r = await fetch(BASE+"/jobs/"+encodeURIComponent(jobId)+"/applications?fields=all&perPage=100&page="+page,{headers:H});
        if(r.status===401){ res.status(401).json({ok:false,erro:"Token da Gupy inválido ou expirado (401)."}); return; }
        if(r.status===403){ res.status(403).json({ok:false,erro:"Token sem permissão para ler candidaturas (403)."}); return; }
        if(r.status===404){ avisos.push("Banco "+jobId+" não encontrado (404)."); break; }
        if(!r.ok){ avisos.push("Banco "+jobId+": Gupy respondeu "+r.status+"."); break; }
        const j=await r.json().catch(()=>null);
        const lista=Array.isArray(j)?j:((j&&(j.results||j.data))||[]);
        brutos.push.apply(brutos,lista);
        if(!Array.isArray(lista)||lista.length<100) break;
      }
      for(const a of brutos){
        totalApi++;
        const stA=String(a.status||a.applicationStatus||"").toLowerCase();
        if(!incluirInativos && INATIVOS.some(x=>stA.includes(x))){ inativas++; continue; }
        const email0=(a.candidate&&(a.candidate.email||a.candidate.emailAddress))||a.email||"";
        const chave=String(a.id||"")+"|"+String(email0).toLowerCase();
        if(vistos.has(chave)){ duplicadas++; continue; }
        vistos.add(chave);
        let ex=extrai(a);
        if(!ex.rico && a.id && (detalheOk+detalheFalha)<120){
          const det=await detalhe(encodeURIComponent(jobId), encodeURIComponent(a.id));
          if(det){
            const mesclado=Object.assign({},a,det,{candidate:Object.assign({},a.candidate||{},det.candidate||det.candidato||{})});
            const ex2=extrai(mesclado);
            if(ex2.rico){ ex=ex2; detalheOk++; } else { detalheFalha++; }
          } else { detalheFalha++; }
        }
        candidatos.push({
          bancoCodigo:String(jobId), applicationId:a.id||null,
          gupyCandidateId:(ex.c&&(ex.c.id||ex.c.candidateId))||a.candidateId||null,
          nome: limpa([ex.c&&ex.c.name, ex.c&&ex.c.lastName].filter(Boolean).join(" "))||limpa(a.name),
          email: email0, telefone:(ex.c&&(ex.c.mobileNumber||ex.c.phoneNumber||ex.c.phone))||"",
          cargo: ex.cargo, experiencias: ex.exps.slice(0,12), formacoes: ex.forms.slice(0,8),
          skills: ex.skills.slice(0,25), idiomas: ex.idiomas.slice(0,6), resumo: ex.resumo, perfilRico: ex.rico
        });
      }
    }
    res.status(200).json({ok:true,total:candidatos.length,totalApi,inativas,duplicadas,detalheOk,detalheFalha,candidatos,avisos});
  }catch(e){ res.status(502).json({ok:false,erro:"Falha ao falar com a Gupy: 
