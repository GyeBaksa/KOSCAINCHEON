const SOURCE='https://incheon.kosca.or.kr/const/status/sidoUpjong.do?menuId=MENU001372';
const industryNames=['지반조성·포장','실내건축','금속·창호·지붕·건축물조립','도장·습식·방수·석공','조경식재·시설물','철근·콘크리트','구조물해체·비계','상·하수도설비','철도·궤도','철강구조물','수중·준설','승강기·삭도'];
const regions=new Set(['서울','전남/광주','부산','대구','인천','대전','울산','세종','경기','강원','충북','충남','전북','경북','경남','제주','합계']);
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const num=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
exports.handler=async()=>{
  try{
    const r=await fetch(SOURCE,{headers:{'user-agent':'Mozilla/5.0 KOSCA-Mobile-App/1.2'},cache:'no-store'});
    if(!r.ok) throw new Error(`source ${r.status}`);
    const html=await r.text(); const rows=[]; const trRe=/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi; let tm;
    while((tm=trRe.exec(html))){const cells=[];const tdRe=/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;let cm;while((cm=tdRe.exec(tm[1])))cells.push(strip(cm[1]));if(cells.length>=15&&regions.has(cells[0])){const industries={};industryNames.forEach((n,i)=>industries[n]=num(cells[i+3]));rows.push({region:cells[0],registrations:num(cells[1]),companies:num(cells[2]),industries});}}
    if(!rows.length) throw new Error('table parse failed');
    const total=rows.find(x=>x.region==='합계'); const regionRows=rows.filter(x=>x.region!=='합계');
    const now=new Date(); const period=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(now).replace(/\.\s?/g,'-').replace(/-$/,'')+' 최신';
    return {statusCode:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=900'},body:JSON.stringify({period,fetchedAt:now.toISOString(),live:true,source:SOURCE,rows:regionRows,total})};
  }catch(e){return {statusCode:502,headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({error:'KOSCA_SYNC_FAILED',message:String(e.message||e),source:SOURCE})};}
};
