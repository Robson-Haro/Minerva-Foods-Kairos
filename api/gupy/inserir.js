// Kairos · Insere o candidato na vaga-alvo da Gupy e dispara o convite oficial (Invite the candidate).
const BASE = "https://api.gupy.io/api/v1";
module.exports = async (req, res) => {
  res.setHeader("Cache-Control","no-store");
  const token = process.env.GUPY_TOKEN;
  if(!token){ res.status(500).json({ok:false,erro:"GUPY_TOKEN não configurado na Vercel."}); return; }
  let body=req.body;
  if(typeof body==="string"){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
  body=body||{};
  const jobId=body.jobId, email=String(body.email||"").trim();
  if(!jobId){ res.status(400).json({ok:false,erro:"jobId da vaga é obrigatório."}); return; }
  if(!body.candidateId && !email){ res.status(400).json({ok:false,erro:"Candidato sem e-mail e sem candidateId — não é possível inserir."}); return; }
  const H={Authorization:"Bearer "+token,Accept:"application/json","Content-Type":"application/json"};
  async function criar(payload){
    const r=await fetch(BASE+"/jobs/"+encodeURIComponent(jobId)+"/applications",{method:"POST",headers:H,body:JSON.stringify(payload)});
    const t=await r.text().catch(()=> ""); let j=null; try{ j=JSON.parse(t); }catch(e){}
    return {status:r.status, ok:r.ok, j, t};
  }
  try{
    let out;
    if(body.candidateId){ out=await criar({candidateId:body.candidateId, notes:"Indicado pelo Kairos · Gestão de Talentos"}); }
    else{
      out=await criar({manualCandidate:{name:body.nome||"-",lastName:body.sobrenome||"-",email,mobileNumber:body.telefone||undefined,insertionSource:"employee_referral"},notes:"Indicado pelo Kairos · Gestão de Talentos"});
      if(out.status===409){
        const cid=(out.j&&(out.j.candidateId||(out.j.results&&out.j.results.candidateId)||(out.j.data&&out.j.data.candidateId)))||null;
        if(cid) out=await criar({candidateId:cid, notes:"Indicado pelo Kairos · Gestão de Talentos"});
        else { res.status(409).json({ok:false,erro:"E-mail já existe na Gupy, mas o candidateId não veio na resposta (409).",detalhe:String(out.t).slice(0,300)}); return; }
      }
    }
    if(out.status===401){ res.status(401).json({ok:false,erro:"Token da Gupy inválido ou expirado (401)."}); return; }
    if(out.status===403){ res.status(403).json({ok:false,erro:"Token sem permissão de escrita em candidaturas (403). Habilite create application e invite no token."}); return; }
    if(!out.ok){ res.status(502).json({ok:false,erro:"Gupy recusou a inserção ("+out.status+").",detalhe:String(out.t).slice(0,300)}); return; }
    const appId=(out.j&&(out.j.id||(out.j.results&&out.j.results.id)||(out.j.data&&out.j.data.id)))||null;
    let conviteOk=false, conviteInfo="";
    if(appId){
      let ri=await fetch(BASE+"/jobs/"+encodeURIComponent(jobId)+"/applications/"+encodeURIComponent(appId)+"/invite",{method:"POST",headers:H,body:"{}"});
      if(ri.status===404){ ri=await fetch(BASE+"/applications/"+encodeURIComponent(appId)+"/invite",{method:"POST",headers:H,body:"{}"}); }
      conviteOk=ri.ok; if(!ri.ok) conviteInfo="convite: Gupy respondeu "+ri.status;
    } else conviteInfo="candidatura criada, mas o id da application não veio na resposta.";
    res.status(200).json({ok:true,applicationId:appId,conviteEnviado:conviteOk,aviso:conviteOk?"":conviteInfo});
  }catch(e){
    res.status(502).json({ok:false,erro:"Falha ao falar com a Gupy: "+(e&&e.message?e.message:"erro de rede")});
  }
};
