"""Remise, statut refusé, dates de statut, signature, avenant, revue des prix, lecture d'un devis fournisseur, sauvegarde automatique."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
CAT = os.environ.get("GPH_CATALOGUE", os.path.join(os.path.dirname(__file__), "../../cat/catalogue_prestations.json"))
async def main():
    ok = True
    def check(n, c, x=""):
        nonlocal ok; ok = ok and bool(c); print(("  ✓ " if c else "  ✗ ") + n + ((" — " + str(x)) if x != "" and not c else ""))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 430, "height": 900}, accept_downloads=True, has_touch=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto("http://localhost:8765/index.html?x=1"); await pg.wait_for_timeout(800)
        await pg.click("[data-a='tab'][data-v='reglages']"); await pg.set_input_files("[data-a='cat-import']", CAT); await pg.wait_for_timeout(2600)
        # revue des prix
        await pg.click("[data-a='tab'][data-v='biblio']"); n0 = await pg.evaluate("S.biblio.filter(prixIndicatif).length"); check("prix indicatifs repérés", n0 > 250, n0)
        txt = await pg.inner_text("#main"); check("compteur total et filtres", "405 prestations au total" in txt and "Créées par la dictée" not in txt and "Prix du marché" in txt, txt[:200])
        await pg.select_option("[data-lib='cat']", "Électricité"); await pg.wait_for_timeout(200); nE = await pg.evaluate("document.querySelectorAll('#main .card.list .it').length"); check("filtre par catégorie", nE == await pg.evaluate("S.biblio.filter(b=>b.metier==='Électricité').length") and nE > 20, nE)
        await pg.click("[data-a='lib-ori'][data-v='moi']"); await pg.wait_for_timeout(200); check("filtre « Mes tarifs » dans la catégorie", await pg.evaluate("document.querySelectorAll('#main .card.list .it').length") == await pg.evaluate("S.biblio.filter(b=>b.metier==='Électricité'&&b.origine!=='marché'&&b.origine!=='auto'&&b.origine!=='manuel').length"))
        await pg.select_option("[data-lib='cat']", ""); await pg.click("[data-a='lib-ori'][data-v='']")
        await pg.click("[data-a='pv-mode'][data-v='1']"); first = await pg.evaluate("document.querySelector('[data-pv]').dataset.pv")
        await pg.fill(f"[data-pv='{first}']", "123,5"); await pg.click(f"[data-a='pv-ok'][data-id='{first}']"); await pg.wait_for_timeout(200)
        check("prix corrigé et validé", await pg.evaluate(f"(b=>b.pu===123.5&&b.verifie===true)(S.biblio.find(x=>x.id==='{first}'))"))
        await pg.click("[data-a='pv-all'] >> nth=0"); await pg.wait_for_timeout(600); n1 = await pg.evaluate("S.biblio.filter(prixIndicatif).length"); check("validation d'un corps d'état entier", n1 < n0 - 2, (n0, n1))
        # devis + remise
        await pg.click("[data-a='tab'][data-v='list']"); await pg.click("[data-a='new']")
        await pg.evaluate("S.draft.dictee='pour madame Tessier 12 rue des Acacias à Rambouillet peinture des murs 50 m² et remplacement du tableau électrique'; aiRun()"); await pg.wait_for_timeout(400)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        check("ligne au prix du marché signalée « Prix indicatif »", await pg.evaluate("S.draft.sections.flatMap(s=>s.lignes).some(ligneIndicative)") and "Prix indicatif" in await pg.inner_text("#main"))
        brut = await pg.evaluate("totaux(S.draft).ht"); await pg.fill("[data-rem='val']", "10"); await pg.wait_for_timeout(150)
        t = await pg.evaluate("totaux(S.draft)"); check("remise 10 %", abs(t["ht"] - round(brut * 0.9, 2)) < 0.011 and abs(t["remise"] - round(brut * 0.1, 2)) < 0.011, t)
        check("remise affichée dans les totaux", "Remise 10 %" in await pg.inner_text(".totals"))
        ht1 = (await pg.evaluate("totaux(S.draft)"))["ht"]; l0 = await pg.evaluate("lineTotal(S.draft.sections[0].lignes[0])")
        await pg.fill("[data-l='remise'] >> nth=0", "20"); await pg.wait_for_timeout(200)
        l1 = await pg.evaluate("lineTotal(S.draft.sections[0].lignes[0])"); ht2 = (await pg.evaluate("totaux(S.draft)"))["ht"]
        check("remise de 20 % sur une seule prestation, cumulée avec la remise globale", abs(l1 - round(l0 * 0.8, 2)) < 0.011 and abs((ht1 - ht2) - round((l0 - l1) * 0.9, 2)) < 0.02, (l0, l1, ht1, ht2))
        # lecture du devis fournisseur
        await pg.set_input_files("[data-a='pj-add']", "/tmp/fournisseur_ttc.pdf"); await pg.wait_for_timeout(500)
        await pg.click("[data-a='pj-read']"); await pg.wait_for_timeout(1800)
        lu = await pg.evaluate("document.querySelectorAll('.lf .it').length"); check("5 lignes lues dans le PDF fournisseur", lu == 5, lu)
        check("prix détectés TTC", await pg.evaluate("document.querySelector(\"[data-a='lf-ttc'][data-v='1']\").classList.contains('on')"))
        await pg.click("[data-a='lf-ok']"); await pg.wait_for_timeout(300)
        f = await pg.evaluate("S.draft.sections.find(s=>s.titre==='Fournitures').lignes.map(l=>[l.designation,l.quantite,l.unite,l.pu,l.source])")
        check("fournitures ajoutées, converties en HT", len(f) == 5 and f[0][1] == 18.72 and abs(f[0][3] - 20.75) < 0.006 and abs(f[3][3] - 1074.17) < 0.006 and all(x[4] == "fournisseur" for x in f), f)
        # génération
        await pg.evaluate("for (const s of S.draft.sections) for (const l of s.lignes) if (l.pu===null) l.pu=10; render()")
        await pg.click("[data-a='step3']"); await pg.wait_for_timeout(200); await pg.click("[data-a='finalize']"); await pg.wait_for_timeout(600)
        num = await pg.evaluate("S.draft.numero")
        # statuts
        await pg.click("[data-a='etat'][data-e='envoye']"); await pg.wait_for_timeout(200)
        check("date d'envoi enregistrée", await pg.evaluate("S.draft.etatDates.envoye===todayISO() && S.draft.dateEnvoi===todayISO()"))
        await pg.click("[data-a='etat'][data-e='refuse']"); await pg.wait_for_timeout(200); check("statut Refusé", await pg.evaluate("etatOf(S.draft)==='refuse' && pdfName(S.draft).includes('REFUSE')"))
        # signature
        await pg.click("[data-a='sign']"); await pg.wait_for_timeout(300); box = await (await pg.query_selector("#sg-cv")).bounding_box()
        await pg.mouse.move(box["x"] + 40, box["y"] + 120); await pg.mouse.down()
        for i in range(1, 30): await pg.mouse.move(box["x"] + 40 + i * 9, box["y"] + 120 + (30 if i % 2 else -30))
        await pg.mouse.up(); await pg.click("[data-a='sign-ok']"); await pg.wait_for_timeout(400)
        check("signature enregistrée, devis accepté", await pg.evaluate("!!S.draft.signature && S.draft.signature.img.startsWith('data:image/png') && etatOf(S.draft)==='accepte' && S.draft.etatDates.accepte===todayISO()"))
        async with pg.expect_download() as dl: await pg.click("[data-a='pdf-dl']")
        d = await dl.value; await d.save_as("test/x_devis.pdf"); check("PDF avec remises et signature", "remise 20" in __import__("subprocess").run(["pdftotext", "test/x_devis.pdf", "-"], capture_output=True, text=True).stdout and os.path.getsize("test/x_devis.pdf") > 20000 and "ACCEPTE" in d.suggested_filename, d.suggested_filename)
        # avenant
        await pg.click("[data-a='avenant']"); await pg.wait_for_timeout(300)
        check("avenant créé (numéro, client, lien)", await pg.evaluate(f"S.draft.numero==='{num}-A1' && S.draft.client.nom==='Mme Tessier' && !!S.draft.avenantDe && S.draft.statut==='brouillon'"))
        await pg.evaluate("S.draft.dictee='pose de deux prises supplémentaires dans la cuisine'; aiRun()"); await pg.wait_for_timeout(400)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        await pg.evaluate("for (const s of S.draft.sections) for (const l of s.lignes) if (l.pu===null) l.pu=10; render()")
        await pg.click("[data-a='step3']"); await pg.wait_for_timeout(200); await pg.click("[data-a='finalize']"); await pg.wait_for_timeout(600)
        check("avenant généré sans consommer de numéro", await pg.evaluate(f"S.draft.numero==='{num}-A1' && S.draft.statut==='finalise' && nextNumero(todayISO()).n===Number('{num}'.split('N')[1])+1"))
        async with pg.expect_download() as dl: await pg.click("[data-a='pdf-dl']")
        d2 = await dl.value; await d2.save_as("test/x_avenant.pdf"); check("PDF d'avenant", d2.suggested_filename.startswith("Avenant_"), d2.suggested_filename)
        # sauvegarde automatique
        await pg.click("[data-a='step2']") if False else None
        await pg.evaluate("setView('reglages')"); await pg.click("[data-a='bk-now']"); await pg.wait_for_timeout(400)
        check("sauvegarde automatique faite", await pg.evaluate("(s=>s.date&&s.devis>=2)(lsGet('gph_autobackup',{})) && JSON.parse(localStorage.getItem('gph_autobackup_data')).devis.length>=2"))
        await pg.evaluate("S.devis.length=0; saveLocal(); render()"); await pg.click("[data-a='bk-list']"); await pg.wait_for_timeout(300); await pg.click("[data-a='bk-restore']"); await pg.wait_for_timeout(900)
        check("restauration d'une sauvegarde", await pg.evaluate("S.devis.length>=2"))
        await pg.evaluate("setView('dash')"); await pg.wait_for_timeout(400); check("tableau de bord toujours fonctionnel", "chiffre d" in (await pg.inner_text("#main")).lower())
        check("aucune erreur JavaScript", not errs, errs); await b.close()
    print("COMPLÉMENTS :", "OK" if ok else "ÉCHEC"); sys.exit(0 if ok else 1)
asyncio.run(main())
