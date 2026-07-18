// Kairos · Importa vagas publicadas (internas e externas) da Gupy. Token só aqui (env GUPY_TOKEN).
const GUPY_BASE = "https://api.gupy.io/api/v1";
function limpaHTML(s){
  return String(s==null?"":s).replace(/<br\s*\/?>/gi,"\n").replace(/<\/(p|li|div|h[1-6]|tr)>/gi,"\n")
    .replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
}
function partes(s){ return limpaHTML(s).split(/\n|;|•|·/).map(x=>x.trim()).filter(x=>x.length>=3); }
module.exports = async (req, res) => {
  res.setHeader("Cache-Control","no-store");
  const token = process.env.GUPY_TOKEN;
  if(!token){ res.status(500).json({ok:false,erro:"GUPY_TOKEN não configurado na Vercel (Settings → Environment Variables → GUPY_TOKEN)."}); return; }
  try{
    const status=(req.query&&req.query.status)||"published";
    const perPage=100; const brutos=[];
    for(let page=1; page<=10; page++){
      const url=GUPY_BASE+"/jobs?fields=all&status="+encodeURIComponent(status)+"&perPage="+perPage+"&page="+page;
      const r=await fetch(url,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
      if(r.status===401){ res.status(401).json({ok:false,erro:"Token da Gupy inválido ou expirado (401). Gere um novo e atualize GUPY_TOKEN na Vercel."}); return; }
      if(r.status===403){ res.status(403).json({ok:false,erro:"Token sem permissão para listar vagas (403)."}); return; }
      if(!r.ok){ const t=await r.text().catch(()=> ""); res.status(502).json({ok:false,erro:"Gupy respondeu "+r.status+".",detalhe:String(t).slice(0,300)}); return; }
      const j=await r.json().catch(()=>null);
      const lista=Array.isArray(j)?j:((j&&(j.results||j.data||j.jobs))||[]);
      brutos.push.apply(brutos,lista);
      if(!Array.isArray(lista)||lista.length<perPage) break;
    }
    const vagas=brutos.map(job=>{
      const descPartes=[limpaHTML(job.description),limpaHTML(job.responsibilities),limpaHTML(job.prerequisites)].filter(Boolean);
      return { id:"gupy-"+job.id, gupyId:job.id, codigo:job.code||job.vacancyCode||"", titulo:job.name||"",
        area:job.departmentName||job.roleName||"", senioridade:"", requisitos:partes(job.prerequisites).slice(0,40),
        descricao:descPartes.join("\n"), resumo:limpaHTML(job.description).slice(0,400),
        filial:[job.addressCity,job.addressState].filter(Boolean).join(" - "),
        tipo:job.type||"", publicacao:job.publicationType||"", numVagas:job.numVacancies||1, status:job.status||"", fonte:"gupy" };
    }).filter(v=>v.titulo);
    res.status(200).json({ok:true,total:vagas.length,vagas});
  }catch(e){
    res.status(502).json({ok:false,erro:"Falha ao falar com a Gupy: "+(e&&e.message?e.message:"erro de rede")});
  }
};
