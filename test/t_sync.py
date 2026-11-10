import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
        ctx=await b.new_context()
        async def route(r):
            u=r.request.url
            if u.endswith("vendor/supabase.js"): await r.fulfill(path="test/mock_supabase.js", content_type="application/javascript")
            elif u.endswith("config.js"): await r.fulfill(body='window.GPH_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"}', content_type="application/javascript")
            else: await r.continue_()
        await ctx.route("**/*", route)
        A=await ctx.new_page(); errs=[]; A.on("pageerror",lambda e:errs.append(str(e)))
        await A.goto("http://localhost:8765/index.html"); await A.wait_for_timeout(800)
        await A.click("[data-a='tab'][data-v='reglages']"); await A.set_input_files("[data-a='cat-import']","/home/claude/gph_catalogue.json"); await A.wait_for_timeout(800)
        await A.click("[data-a='tab'][data-v='list']"); await A.click("[data-a='new']")
        await A.fill("[data-in='dictee']","Devis pour monsieur Dupont, 9 rue de Gaudré à Limours. Chambre : dépose du papier peint 28 m2. Enduit et peinture satin 28 m2 à 38 euros.")
        await A.click("[data-a='ai-run']"); await A.wait_for_timeout(300); await A.click("[data-a='close']") if await A.query_selector("[data-a='close']") else None
        await A.click("[data-a='step3']"); await A.click("[data-a='finalize']"); await A.wait_for_timeout(1500)
        qa=await A.evaluate("({num:S.draft.numero, queue:lsGet('gph_queue',[]).length, sync:document.getElementById('syncst')?.textContent})")
        db=await A.evaluate("JSON.parse(localStorage.MOCKDB).length")
        # second device: wipe local caches except MOCKDB
        await A.evaluate("Object.keys(localStorage).filter(k=>k!=='MOCKDB').forEach(k=>localStorage.removeItem(k))")
        B=await ctx.new_page(); await B.goto("http://localhost:8765/index.html"); await B.wait_for_timeout(1500)
        qb=await B.evaluate("({devis:S.devis.map(d=>d.numero+' '+d.client.nom), biblio:S.biblio.length, next:nextNumero(todayISO()).numero})")
        print("Appareil A:",qa," | lignes en base:",db); print("Appareil B:",json.dumps(qb,ensure_ascii=False)); print("errors:",errs)
        await b.close()
asyncio.run(main())
