// Kairos · Relay para o fluxo "Kairos - E-mails" do Power Automate (Outlook corporativo).
module.exports = async (req, res) => {
  res.setHeader("Cache-Control","no-store");
  const url = process.env.AUTOMATE_URL;
  if(!url){ res.status(500).json({ok:false,erro:"AUTOMATE_URL não configurada na Vercel — salve o fluxo do Power Automate (após a licença Premium) e cole a URL secreta em Settings → Environment Variables → AUTOMATE_URL."}); return; }
  let body=req.body; if(typeof body==="string"){ try{ body=JSON.parse(body); }catch(e){ body={}; } } body=body||{};
  const para=String(body.para||"").trim();
  if(!para || !/@/.test(para)){ res.status(400).json({ok:false,erro:"Destinatário (para) inválido."}); return; }
  try{
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tipo:String(body.tipo||""),para,assunto:String(body.assunto||""),corpo:String(body.corpo||"")})});
    if(r.ok || r.status===202){ res.status(200).json({ok:true}); return; }
    const t=await r.text().catch(()=> "");
    res.status(502).json({ok:false,erro:"Power Automate respondeu "+r.status+".",detalhe:String(t).slice(0,200)});
  }catch(e){
    res.status(502).json({ok:false,erro:"Falha ao falar com o Power Automate: "+(e&&e.message?e.message:"erro de rede")});
  }
};
