"""Sélection multiple dans l'onglet Devis : statut, export, suppression."""
import asyncio, sys
from playwright.async_api import async_playwright
SEED = """(()=>{const mk=(i,nom,st)=>({id:'s'+i,statut:st,etat:st==='finalise'?'attente':null,numero:st==='finalise'?'202611N0'+i:null,date:todayISO(),exercice:exerciceKey(todayISO()),client:{nom},tva:10,acomptes:[40,40,20],pj:[],objet:'Travaux',sections:[{titre:'T',lignes:[{type:'mo',designation:'x',quantite:1,unite:'forfait',pu:1000*i}]}]});
 S.devis=[mk(1,'A','finalise'),mk(2,'B','finalise'),mk(3,'C','finalise'),mk(4,'D','brouillon')];S.devis.forEach(d=>d.totaux=totaux(d));setView('list')})()"""
async def main():
    ok = True
    def check(n, c, x=""):
        nonlocal ok; ok = ok and bool(c); print(("  ✓ " if c else "  ✗ ") + n + ((" — " + str(x)) if x != "" and not c else ""))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); pg = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); await pg.goto("http://localhost:8765/index.html?s=1"); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(200)
        await pg.click("[data-a='sel-on']"); await pg.click(".it[data-id='s1']"); await pg.click(".it[data-id='s2']"); await pg.click(".it[data-id='s4']"); await pg.wait_for_timeout(100)
        check("3 devis cochés, total affiché", "3 sélectionnés" in await pg.inner_text(".selbar") and "7700,00" in (await pg.inner_text(".selbar")).replace("\u202f","").replace("\xa0","").replace(" ",""), await pg.inner_text(".selbar"))
        check("un appui coche au lieu d'ouvrir", await pg.evaluate("S.view==='list' && !S.draft"))
        await pg.screenshot(path="test/sel.png")
        await pg.click("[data-a='sel-etat']"); await pg.click("[data-a='sel-etat-ok'][data-e='envoye']"); await pg.wait_for_timeout(300)
        check("statut changé pour les 2 devis générés, brouillon ignoré", await pg.evaluate("etatOf(S.devis[0])==='envoye'&&etatOf(S.devis[1])==='envoye'&&S.devis[0].etatDates.envoye===todayISO()&&etatOf(S.devis[2])==='attente'&&S.devis[3].statut==='brouillon'"))
        async with pg.expect_download() as dl: await pg.click("[data-a='sel-csv']")
        d = await dl.value; await d.save_as("test/sel.csv"); t = open("test/sel.csv", encoding="utf-8-sig").read(); check("export de la sélection", t.count("\n") == 3 and "Envoyé" in t and "1000" in t, t[:200])
        await pg.click("[data-a='sel-del']"); await pg.wait_for_timeout(150); check("confirmation avant suppression", "définitive" in await pg.inner_text("#modal")); await pg.click("[data-a='sel-del-ok']"); await pg.wait_for_timeout(300)
        check("3 devis supprimés, 1 conservé", await pg.evaluate("S.devis.length===1 && S.devis[0].id==='s3'"))
        await pg.click("[data-a='sel-all']"); check("tout sélectionner", await pg.evaluate("S.sel.size===1")); await pg.click("[data-a='sel-off']"); await pg.click(".it[data-id='s3']"); await pg.wait_for_timeout(200)
        check("hors sélection, un appui ouvre le devis", await pg.evaluate("S.view==='edit'")); check("aucune erreur JavaScript", not errs, errs); await b.close()
    print("SÉLECTION :", "OK" if ok else "ÉCHEC"); sys.exit(0 if ok else 1)
asyncio.run(main())
