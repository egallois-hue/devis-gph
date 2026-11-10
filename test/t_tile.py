import asyncio, json
from playwright.async_api import async_playwright
DICT = "Devis pour madame Martin 3 rue des Lilas à Dourdan. Cuisine : pose de carrelage soixante soixante avec joint fin 18 m2. Peinture des murs 30 m2 fournitures comprises. Fournitures : carrelage 60x60 gris 20 m2 à 32 euros, colle Weber 6 sacs à 21 euros."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        await pg.goto("http://localhost:8765/index.html?t=2"); await pg.wait_for_timeout(800)
        if await pg.query_selector("[data-a='offline-mode']"): await pg.click("[data-a='offline-mode']")
        await pg.click("[data-a='tab'][data-v='reglages']"); await pg.wait_for_timeout(200)
        await pg.set_input_files("[data-a='cat-import']", "/home/claude/catalogue_prestations.json"); await pg.wait_for_timeout(500)
        await pg.fill("[data-tcf='3']", "-8"); await pg.click("[data-a='cfg-save']"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="test/t_regl.png", full_page=True)
        await pg.click("[data-a='tab'][data-v='list']"); await pg.click("[data-a='new']")
        await pg.fill("[data-in='dictee']", DICT); await pg.click("[data-a='ai-run']"); await pg.wait_for_timeout(400)
        if await pg.query_selector("[data-a='close']"): await pg.click("[data-a='close']")
        await pg.screenshot(path="test/t_step2.png", full_page=True)
        print(await pg.evaluate("S.draft.sections.map(s=>s.lignes.map(l=>l.designation+' pu='+l.pu+' fc='+!!l.fournitureComprise).join(' | '))"))
        await pg.click("[data-a='step3']"); await pg.click("[data-a='finalize']"); await pg.wait_for_timeout(500)
        async with pg.expect_download() as dl: await pg.click("[data-a='pdf-dl']")
        d = await dl.value; await d.save_as("test/t_out.pdf"); print(d.suggested_filename)
        print("P044 pu after learn:", await pg.evaluate("S.biblio.find(b=>b.id==='P044').pu"), "P021:", await pg.evaluate("S.biblio.find(b=>b.id==='P021').pu"))
        print("errors:", errs); await b.close()
asyncio.run(main())
