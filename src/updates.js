// Never interrupt an active run. New builds are picked up in menus or explicitly.
export function watchUpdates(isSafeToReload) {
  let checking=false, offered=false;
  const check=async()=>{
    if(checking||document.hidden||offered)return;
    checking=true;
    try {
      const r=await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)return;
      const v=await r.json();
      if(!v.build || v.build===__BUILD_ID__)return;
      offered=true;
      const reload=()=>{const url=new URL(location.href);url.searchParams.set('v',v.build);url.searchParams.set('refresh',String(Date.now()));location.replace(url.href);};
      if(isSafeToReload()){reload();return;}
      const b=document.createElement('button');b.id='update-notice';b.textContent='Новый Moggman готов · обновить после забега';
      b.onclick=()=>{if(isSafeToReload())reload();else b.textContent='Заверши забег или выйди в меню — обновление подождёт';};
      document.querySelector('#app').append(b);
      const wait=setInterval(()=>{if(isSafeToReload()){clearInterval(wait);reload();}},1500);
    } catch { /* Offline games continue without interruption. */ }
    finally {checking=false;}
  };
  document.addEventListener('visibilitychange',check);
  window.addEventListener('focus',check);
  setInterval(check,60000);
  setTimeout(check,1500);
}
