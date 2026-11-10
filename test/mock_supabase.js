// Faux Supabase en mémoire partagé via localStorage "MOCKDB" (pour simuler 2 appareils)
(function(){
 const load=()=>JSON.parse(localStorage.getItem("MOCKDB")||"[]"), save=x=>localStorage.setItem("MOCKDB",JSON.stringify(x));
 let t=1000;
 function from(){ let f={gt:null,range:[0,999]};
  const api={ upsert(rows){ const db=load(); for(const r of rows){ const i=db.findIndex(x=>x.owner===r.owner&&x.collection===r.collection&&x.id===r.id); const row=Object.assign({},r,{updated_at:new Date(Date.now()+(t++)).toISOString()}); if(i>=0)db[i]=row; else db.push(row);} save(db); return Promise.resolve({error:null}); },
   select(){return api}, order(){return api}, range(a,b){f.range=[a,b];return api}, gt(c,v){f.gt=v;return api},
   then(res){ let d=load().filter(x=>x.owner==="u1"&&(!f.gt||x.updated_at>f.gt)).sort((a,b)=>a.updated_at<b.updated_at?-1:1).slice(f.range[0],f.range[1]+1); res({data:d,error:null}); } };
  return api; }
 window.supabase={createClient(){ return { from, auth:{ getSession:()=>Promise.resolve({data:{session:{user:{id:"u1",email:"philippe@test.fr"}}}}), onAuthStateChange(){}, signOut:()=>Promise.resolve() },
   storage:{from(){return{upload:()=>Promise.resolve({error:null}),download:()=>Promise.resolve({error:"x"})}}} }; }};
})();
