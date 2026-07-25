// Kairos · Bancos internos Gupy — v3.1 compacta (lista + detalhe/curriculo + filtro de inativas)
const BASE="https://api.gupy.io/api/v1";
const limpa=s=>String(s==null?"":s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const arr=x=>Array.isArray(x)?x:[];
function extrai(a){
  const c=a.candidate||a.candidato||a;
  const exps=[...arr(c.professionalExperiences),...arr(c.experiences),...arr(a.professionalExperiences)].map(e=>limpa([e&&(e.role||e.position||e.title),e&&(e.company||e.institution),e&&(e.description||e.activities)].filter(Boolean).join(" - "))).filter(Boolean);
  const forms=[...arr(c.formations),...arr(c.educations)].map(e=>limpa([e&&(e.course||e.name),e&&(e.institution||e.school)].filter(Boolean).join(" - "))).filter(Boolean);
  const skills=arr(c.skills).map(x=>limpa(typeof x==="string"?x:(x&&x.name)||"")).filter(Boolean);
  const idiomas=arr(c.languages).map(x=>limpa(typeof x==="string"?x:[x&&x.language,x&&x.level].filter(Boolean).join(" "))).filter(Boolean);
  const cargo=limpa(c.currentJob||c.jobTitle||"")||(exps[0]?exps[0].split(" - ")[0]:"");
  const resumo=limpa(c.summary||c.about||"");
  return {c,exps,forms,skills,idiomas,cargo,resumo,rico:(exps.length+forms.length+skills.length)>0||resumo.length>=40};
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  const token=process.env.GUPY_TOKEN;
  if(!token) return res.status(500).json({ok:false,erro:"GUPY_TOKEN nao configurado na Vercel."});
  const H={Authorization:"Bearer "+token,Accept:"application/json"};
  const ids=String((req.query&&req.query.jobIds)||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,40);
  if(!ids.length) return res.status(400).json({ok:false,erro:"Informe jobIds."});
  const INAT=["reproved","disqualified","withdrawn","cancel","reject","declin","desist"];
  const cands=[],avisos=[],vistos=new Set();
  let totalApi=0,inativas=0,duplicadas=0,detalheOk=0,detalheFalha=0;
  try{
    for(const jobId of ids){
      for(let page=1;page<=10;page++){
        const r=await fetch(BASE+"/jobs/"+encodeURIComponent(jobId)+"/applications?fields=all&perPage=100&page="+page,{headers:H});
        if(r.status===401) return res.status(401).json({ok:false,erro:"Token da Gupy invalido ou expirado (401)."});
        if(r.status===403) return res.status(403).json({ok:false,erro:"Token sem permissao para ler candidaturas (403)."});
        if(!r.ok){avisos.push("Banco "+jobId+": Gupy respondeu "+r.status+".");break;}
        const j=await r.json().catch(()=>null);
        const lista=Array.isArray(j)?j:((j&&(j.results||j.data))||[]);
        for(const a of lista){
          totalApi++;
          const st=String(a.status||"").toLowerCase();
          if(INAT.some(x=>st.includes(x))){inativas++;continue;}
          const email=(a.candidate&&a.candidate.email)||a.email||"";
          const k=String(a.id||"")+"|"+email.toLowerCase();
          if(vistos.has(k)){duplicadas++;continue;}
          vistos.add(k);
          let ex=extrai(a);
          if(!ex.rico&&a.id&&(detalheOk+detalheFalha)<120){
            let det=null;
            for(const u of [BASE+"/jobs/"+encodeURIComponent(jobId)+"/applications/"+encodeURIComponent(a.id),BASE+"/applications/"+encodeURIComponent(a.id)]){
              try{const rd=await fetch(u,{headers:H}); if(rd.ok){const jd=await rd.json().catch(()=>null); if(jd){det=jd.results||jd.data||jd;break;}}}catch(e){}
            }
            if(det){const ex2=extrai(Object.assign({},a,det,{candidate:Object.assign({},a.candidate||{},det.candidate||{})})); if(ex2.rico){ex=ex2;detalheOk++;}else{detalheFalha++;}}
            else{detalheFalha++;}
          }
          cands.push({bancoCodigo:String(jobId),applicationId:a.id||null,gupyCandidateId:(ex.c&&ex.c.id)||null,nome:limpa([ex.c&&ex.c.name,ex.c&&ex.c.lastName].filter(Boolean).join(" ")),email:email,telefone:(ex.c&&(ex.c.mobileNumber||ex.c.phone))||"",cargo:ex.cargo,experiencias:ex.exps.slice(0,12),formacoes:ex.forms.slice(0,8),skills:ex.skills.slice(0,25),idiomas:ex.idiomas.slice(0,6),resumo:ex.resumo,perfilRico:ex.rico});
        }
        if(!Array.isArray(lista)||lista.length<100)break;
      }
    }
    return res.status(200).json({ok:true,total:cands.length,totalApi,inativas,duplicadas,detalheOk,detalheFalha,candidatos:cands,avisos});
  }catch(e){
    return res.status(502).json({ok:false,erro:"Falha ao falar com a Gupy: "+((e&&e.message)||"erro"),avisos});
  }
};
