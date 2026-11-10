"""Parcours complet dans un vrai navigateur (Chrome sans écran, taille iPhone) :
dictée parlée → Mettre en forme → questions → correction retenue (apprentissage) → devis → PDF.
Usage : python3 test/t_e2e.py   (serveur : python3 -m http.server 8765 à la racine ; catalogue : $GPH_CATALOGUE)"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
CAT = os.environ.get("GPH_CATALOGUE", os.path.join(os.path.dirname(__file__), "../../devis_src/catalogue_seed.json"))
DICT = ("bonjour alors c'est pour un devis chez madame Tessier elle habite au 12 rue des Acacias à Rambouillet elle veut refaire sa cuisine "
        "donc il faut enlever la vieille faïence il y en a à peu près 6 m² après je repose une crédence en carrelage 6 m² et je lui change son robinet d'évier "
        "et puis elle veut aussi deux prises en plus au dessus du plan de travail compter deux jours de travail")
AMBIGU = "pour monsieur Petit 3 rue du Test à Limours trois prises dans le salon"
async def main():
    ok = True
    def check(name, cond, extra=""):
        nonlocal ok; ok = ok and bool(cond); print(("  ✓ " if cond else "  ✗ ") + name + (" — " + str(extra) if extra and not cond else ""))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(800)
        await pg.click("[data-a='tab'][data-v='reglages']"); await pg.wait_for_timeout(200)
        await pg.set_input_files("[data-a='cat-import']", CAT); await pg.wait_for_timeout(600)
        check("catalogue importé", await pg.evaluate("S.biblio.length") >= 90)
        check("moteur version 2 chargé", await pg.evaluate("window.Moteur.VERSION") == 2)
        await pg.click("[data-a='tab'][data-v='list']"); await pg.click("[data-a='new']")
        await pg.fill("[data-in='dictee']", DICT)
        t0 = await pg.evaluate("performance.now()"); await pg.click("[data-a='ai-run']"); await pg.wait_for_timeout(400)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        lines = await pg.evaluate("S.draft.sections.flatMap(s=>s.lignes.map(l=>({id:l.biblio_id,q:l.quantite,u:l.unite,pu:l.pu,inc:!!l.incertain,cle:l.cle||'',raw:l.raw})))")
        ids = [(l["id"], l["q"]) for l in lines]
        check("client reconnu", await pg.evaluate("S.draft.client.nom") == "Mme Tessier" and await pg.evaluate("S.draft.client.adresse") == "12 rue des Acacias")
        check("dépose faïence 6 m²", ("P010", 6) in ids, ids); check("pose carrelage 6 m²", ("P044", 6) in ids, ids)
        check("mitigeur", ("P061", 1) in ids, ids); check("2 prises créées", ("P069", 2) in ids, ids)
        check("durée 2 jours", await pg.evaluate("S.draft.dureeJours") == 2)
        check("aucun prix inventé (tous viennent du catalogue)", await pg.evaluate("S.draft.sections.every(s=>s.lignes.every(l=>l.pu===null||l.source==='bibliotheque'||l.source==='dicte'))"))
        await pg.screenshot(path="test/e_step2.png", full_page=True)
        # tournure ambiguë (« 3 prises » sans verbe : remplacement ou création ?)
        await pg.evaluate(f"S.draft.dictee={json.dumps(AMBIGU)}; aiRun()"); await pg.wait_for_timeout(300)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        lines = await pg.evaluate("S.draft.sections.flatMap(s=>s.lignes.map(l=>({id:l.biblio_id,q:l.quantite,inc:!!l.incertain,raw:l.raw})))")
        amb = [l for l in lines if l["raw"] and "3 prises" in l["raw"]]
        check("« 3 prises » sans verbe : ligne marquée à vérifier", amb and amb[0]["inc"], amb)
        check("une question de confirmation est posée", await pg.evaluate("(S.draft.questions||[]).some(q=>q.kind==='choix')"))
        await pg.screenshot(path="test/e_question.png", full_page=True)
        # réponse à la question : « 2 » (création d'une prise) → retenu pour la prochaine fois
        qi = await pg.evaluate("S.draft.questions.findIndex(q=>q.kind==='choix')")
        await pg.fill(f"[data-qa='{qi}']", "2"); await pg.click("[data-a='q-apply']"); await pg.wait_for_timeout(300)
        after = await pg.evaluate("S.draft.sections.flatMap(s=>s.lignes).filter(l=>l.raw&&l.raw.includes('3 prises')).map(l=>[l.biblio_id,l.quantite,!!l.incertain])")
        check("réponse appliquée", after and after[0][0] != amb[0]["id"] and not after[0][2], after)
        check("correction mémorisée", await pg.evaluate("Object.keys(S.appris).length") >= 1)
        learned = after[0][0]
        # nouvelle dictée : la même tournure est reconnue directement
        await pg.evaluate(f"S.draft.dictee={json.dumps(AMBIGU.replace('salon', 'couloir'))}; aiRun()"); await pg.wait_for_timeout(300)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        again = await pg.evaluate("S.draft.sections.flatMap(s=>s.lignes).map(l=>[l.biblio_id,l.quantite,!!l.incertain])")
        check("apprentissage : reconnu directement la fois suivante", [learned, 3, False] in again, again)
        # devis complet → PDF
        await pg.evaluate(f"S.draft.dictee={json.dumps(DICT)}; aiRun()"); await pg.wait_for_timeout(300)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        await pg.evaluate("for (const s of S.draft.sections) for (const l of s.lignes) if (l.pu===null) l.pu=10; render()")
        await pg.click("[data-a='step3']"); await pg.wait_for_timeout(200)
        await pg.click("[data-a='finalize']"); await pg.wait_for_timeout(500)
        async with pg.expect_download() as dl: await pg.click("[data-a='pdf-dl']")
        d = await dl.value; await d.save_as("test/e_out.pdf")
        check("PDF produit", os.path.getsize("test/e_out.pdf") > 20000, d.suggested_filename)
        ms = await pg.evaluate(f"(()=>{{const t=performance.now();for(let i=0;i<20;i++)window.Moteur.analyse({json.dumps(DICT)},S.biblio);return (performance.now()-t)/20}})()")
        check(f"temps de traitement d'une dictée longue : {ms:.1f} ms", ms < 300)
        check("aucune erreur JavaScript", not errs, errs)
        await b.close()
    print("PARCOURS COMPLET :", "OK" if ok else "ÉCHEC"); sys.exit(0 if ok else 1)
asyncio.run(main())
