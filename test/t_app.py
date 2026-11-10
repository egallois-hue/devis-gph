import asyncio, json, os
from playwright.async_api import async_playwright
DICT = "Devis pour madame Durand, 10 rue des Essais 91410 Dourdan. Protection et nettoyage du chantier et évacuation à la déchetterie. Salle de bains : dépose de la baignoire et du meuble lavabo. Dépose du carrelage sol et mur 31 m2. Pose de carrelage au sol 6 m2 et faïence murale 25 mètres carrés. 4 spots. Fournitures : receveur de douche 140 par 100 à 531 euros 19, colle Weber flex 8 sacs à 36,65 euros, mitigeur lavabo."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(800)
        # import catalogue
        await pg.set_input_files("[data-a='cat-import']", "/home/claude/gph_catalogue.json") if await pg.query_selector("[data-a='cat-import']") else None
        await pg.click("[data-a='tab'][data-v='reglages']"); await pg.wait_for_timeout(200)
        await pg.set_input_files("[data-a='cat-import']", "/home/claude/gph_catalogue.json"); await pg.wait_for_timeout(500)
        nb = await pg.evaluate("S.biblio.length")
        await pg.click("[data-a='tab'][data-v='list']"); await pg.click("[data-a='new']")
        await pg.fill("[data-in='dictee']", DICT); await pg.click("[data-a='ai-run']"); await pg.wait_for_timeout(400)
        await pg.click("[data-a='close']")
        await pg.screenshot(path="test/a_step2.png", full_page=True)
        # fill missing price (mitigeur)
        await pg.evaluate("for (const s of S.draft.sections) for (const l of s.lignes) if (l.pu===null) l.pu=193.35; render()")
        await pg.click("[data-a='step3']"); await pg.wait_for_timeout(200)
        await pg.click("[data-a='finalize']"); await pg.wait_for_timeout(500)
        await pg.screenshot(path="test/a_step3.png", full_page=True)
        async with pg.expect_download() as dl:
            await pg.click("[data-a='pdf-dl']")
        d = await dl.value; await d.save_as("test/out.pdf")
        info = await pg.evaluate("({num:S.draft.numero, tot:totaux(S.draft), biblio:S.biblio.length, auto:S.biblio.filter(b=>b.origine==='auto').length, lines:S.draft.sections.map(s=>s.titre+': '+s.lignes.map(l=>l.designation.slice(0,35)+' q='+l.quantite+' pu='+l.pu).join(' | ')), aliases:S.biblio.filter(b=>(b.aliases||[]).some(a=>a.includes('baignoire'))).map(b=>b.aliases), queue:lsGet('gph_queue',[]).length})")
        print("catalogue importé:", nb); print(json.dumps(info, ensure_ascii=False)); print("errors:", errs)
        await b.close()
asyncio.run(main())
