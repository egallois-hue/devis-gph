"""Tableau de bord : état vide, puis rempli avec des devis de démonstration (créés seulement dans ce test)."""
import asyncio, sys
from playwright.async_api import async_playwright
SEED = """
(()=>{ const t=new Date(), iso=d=>d.toISOString().slice(0,10), add=(n)=>{const x=new Date(t);x.setDate(x.getDate()+n);return iso(x)};
 const mk=(i,nom,etat,ht,dj,debut,fin,metier)=>({id:'t'+i,statut:'finalise',etat,numero:'2026'+String(i).padStart(2,'0')+'N'+i,date:add(dj),exercice:exerciceKey(add(dj)),client:{nom},tva:10,acomptes:[40,40,20],debut,finPrevue:fin,
   sections:[{titre:'Travaux',lignes:[{type:'mo',designation:'Peinture',quantite:1,unite:'forfait',pu:ht*0.6,biblio_id:'P021'},{type:'mo',designation:'Carrelage',quantite:1,unite:'forfait',pu:ht*0.4,biblio_id:'P044'}]}]});
 S.devis=[mk(1,'Mme Tessier','paye',8400,-300),mk(2,'M. Aubert','paye',3200,-240),mk(3,'M. et Mme Renard','fini',12600,-170),mk(4,'Mme Colin','acompte2',5400,-110,add(-30),add(-3)),
  mk(5,'M. Navarro','en_cours',9800,-60,add(-6),add(12)),mk(6,'Mme Besson','accepte',4300,-20,add(9),add(21)),mk(7,'M. Lefort','envoye',7600,-18),mk(8,'Mme Hamel','envoye',2100,-4),
  mk(9,'M. Chevalier','attente',6500,-1),mk(10,'Mme Perrot','acompte1',15200,-35,add(16),add(40)),mk(11,'M. Julien','paye',6100,-200),mk(12,'Mme Vasseur','paye',2800,-140)];
 S.devis.forEach(d=>d.totaux=totaux(d)); S.devis.push({id:'b1',statut:'brouillon',client:{nom:'Test'},sections:[]}); setView('dash'); })()
"""
async def main():
    ok = True
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); errs = []
        for name, vp in (("mobile", {"width": 390, "height": 844}), ("bureau", {"width": 1280, "height": 900})):
            pg = await (await b.new_context(viewport=vp, device_scale_factor=2)).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("http://localhost:8765/index.html?t=" + name); await pg.wait_for_timeout(900)
            if name == "mobile":
                vide = await pg.inner_text("#main"); ok &= "se remplira tout seul" in vide; await pg.screenshot(path="test/dash_vide.png")
            await pg.evaluate(SEED); await pg.wait_for_timeout(1800)
            await pg.screenshot(path=f"test/dash_{name}.png", full_page=True)
            txt = await pg.inner_text("#main")
            big = await pg.inner_text(".d-big"); ok &= "€" in big and "0 €" != big.strip()
            ok &= all(x in txt for x in ("À faire", "Planning des chantiers", "Argent à réclamer", "Meilleurs clients"))
            if name == "mobile":
                print("  CA affiché :", big.replace("\n", " "), "| taux :", (await pg.text_content(".d-ring")).replace("\n", " "))
                await pg.click(".d-seg button[data-p='tout']"); await pg.wait_for_timeout(300)
                await pg.click(".d-al .a.r"); await pg.wait_for_timeout(300); ok &= await pg.evaluate("S.view==='list' && S.fe==='retard'")
        await b.close()
    print("erreurs JS :", errs); print("TABLEAU DE BORD :", "OK" if ok and not errs else "ÉCHEC"); sys.exit(0 if ok and not errs else 1)
asyncio.run(main())
