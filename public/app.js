(() => {
  'use strict';

  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const main = $('#main');
  const title = $('#pageTitle');
  const detailDialog = $('#detailDialog');
  const pdfDialog = $('#pdfDialog');
  const toastEl = $('#toast');

  const KEYS = {
    members:'kosca_members_v1', groups:'kosca_groups_v1', work:'kosca_work_v1',
    stats:'kosca_stats_v1', pin:'kosca_admin_pin_v1', adminUntil:'kosca_admin_until_v1', logs:'kosca_logs_v1'
  };

  const seedGroups = ['대표회원','회장단','운영위원','감사'];
  const seedMembers = [
    {id:'m1',name:'홍길동',company:'대한건설(주)',title:'대표이사',mobile:'010-1234-5678',office:'032-123-4567',email:'',groups:['대표회원','운영위원'],note:''},
    {id:'m2',name:'김전문',company:'인천전문건설(주)',title:'대표이사',mobile:'010-2345-6789',office:'032-234-5678',email:'',groups:['회장단','대표회원'],note:''},
    {id:'m3',name:'이건설',company:'한국건설산업(주)',title:'대표',mobile:'010-3456-7890',office:'032-345-6789',email:'',groups:['운영위원'],note:''}
  ];
  const seedWork = [
    {id:'w1',category:'인천광역시',org:'인천광역시',dept:'건설심사과',name:'담당자',title:'주무관',work:'전문건설업 관련 업무',office:'032-000-0000',mobile:'',email:'',note:''},
    {id:'w2',category:'유관기관',org:'전문건설공제조합',dept:'인천지점',name:'담당자',title:'',work:'보증 관련 업무',office:'032-000-0001',mobile:'',email:'',note:''}
  ];

  // 2026-09-04 확인된 대한전문건설협회 등록분포현황(2026년 8월 기준) 캐시.
  const seedStats = {
    period:'2026년 08월', fetchedAt:'2026-09-04T17:20:00+09:00', live:false,
    source:'https://incheon.kosca.or.kr/const/status/sidoUpjong.do?menuId=MENU001372',
    rows:[
      {region:'서울',registrations:10942,companies:7923},{region:'전남/광주',registrations:9369,companies:5884},
      {region:'부산',registrations:3741,companies:2596},{region:'대구',registrations:2441,companies:1758},
      {region:'인천',registrations:3317,companies:2265,industries:{'지반조성·포장':417,'실내건축':572,'금속·창호·지붕·건축물조립':456,'도장·습식·방수·석공':445,'조경식재·시설물':403,'철근·콘크리트':283,'구조물해체·비계':201,'상·하수도설비':426,'철도·궤도':2,'철강구조물':37,'수중·준설':18,'승강기·삭도':57}},
      {region:'대전',registrations:1923,companies:1393},{region:'울산',registrations:1708,companies:1108},{region:'세종',registrations:450,companies:286},
      {region:'경기',registrations:16395,companies:12070},{region:'강원',registrations:5089,companies:3097},{region:'충북',registrations:4816,companies:2830},
      {region:'충남',registrations:5875,companies:3624},{region:'전북',registrations:5486,companies:3363},{region:'경북',registrations:8478,companies:5135},
      {region:'경남',registrations:6921,companies:4463},{region:'제주',registrations:1938,companies:1275}
    ],
    total:{region:'합계',registrations:88889,companies:59070,industries:{'지반조성·포장':13708,'실내건축':12958,'금속·창호·지붕·건축물조립':11213,'도장·습식·방수·석공':12222,'조경식재·시설물':8831,'철근·콘크리트':13358,'구조물해체·비계':5483,'상·하수도설비':8782,'철도·궤도':46,'철강구조물':984,'수중·준설':450,'승강기·삭도':854}}
  };

  const load = (k, fallback) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fallback; } catch { return fallback; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const API='/api/app';
  const ADMIN_TOKEN_KEY='kosca_admin_token_v12';
  const ADMIN_EXP_KEY='kosca_admin_exp_v12';
  let sharedReady=false;
  let sharedError='';

  async function api(path='',options={},auth=false){
    const headers={...(options.headers||{})};
    if(options.body && !headers['content-type']) headers['content-type']='application/json';
    if(auth){ const token=localStorage.getItem(ADMIN_TOKEN_KEY)||''; if(token) headers.authorization='Bearer '+token; }
    const res=await fetch(API+path,{...options,headers,cache:'no-store'});
    let data={}; try{data=await res.json();}catch{}
    if(!res.ok) throw new Error(data.message||`서버 오류 (${res.status})`);
    return data;
  }
  async function refreshSharedData(showMessage=false){
    try{
      const [m,w]=await Promise.all([api('?resource=members'),api('?resource=work')]);
      const members=Array.isArray(m.items)?m.items:[];
      const work=Array.isArray(w.items)?w.items:[];
      save(KEYS.members,members);
      save(KEYS.groups,[...new Set(members.flatMap(x=>x.groups||[]).filter(Boolean))]);
      save(KEYS.work,work);
      sharedReady=true; sharedError='';
      if(showMessage) toast('공용 데이터베이스에서 최신 자료를 불러왔습니다.');
      if(state.route!=='admin' || !state.adminPanel) render();
    }catch(e){ sharedError=e.message||'공용 데이터베이스 연결 실패'; if(showMessage) toast(sharedError); }
  }
  async function pushMembers(){
    const items=load(KEYS.members,[]).filter(m=>m.name||m.company||m.mobile||m.office);
    await api('?resource=members',{method:'PUT',body:JSON.stringify({items})},true);
    await refreshSharedData(false);
  }
  async function pushWork(){
    const items=load(KEYS.work,[]).filter(x=>x.org||x.name||x.office||x.mobile);
    await api('?resource=work',{method:'PUT',body:JSON.stringify({items})},true);
    await refreshSharedData(false);
  }
  if(!localStorage.getItem(KEYS.members)) save(KEYS.members, seedMembers);
  if(!localStorage.getItem(KEYS.groups)) save(KEYS.groups, seedGroups);
  if(!localStorage.getItem(KEYS.work)) save(KEYS.work, seedWork);
  if(!localStorage.getItem(KEYS.stats)) save(KEYS.stats, seedStats);
  if(!localStorage.getItem(KEYS.pin)) localStorage.setItem(KEYS.pin, hashPin('2580'));
  if(!localStorage.getItem(KEYS.logs)) save(KEYS.logs, []);

  let state = {route:'members', group:null, memberQ:'', workCategory:'전체', workQ:'', statsRegion:'인천', docCategory:'전체', docQ:'', adminPanel:null};

  function hashPin(s){ let h=2166136261; for(const ch of String(s)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(16); }
  function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function fmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
  function onlyDigits(s=''){ return String(s).replace(/[^0-9+]/g,''); }
  function id(prefix){ return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.classList.remove('show'),2200); }
  function log(action){ const logs=load(KEYS.logs,[]); logs.unshift({at:new Date().toISOString(),action}); save(KEYS.logs,logs.slice(0,100)); }
  function adminOK(){ return !!localStorage.getItem(ADMIN_TOKEN_KEY) && Number(localStorage.getItem(ADMIN_EXP_KEY)||0) > Date.now(); }
  function setAdmin(token,expiresAt){ localStorage.setItem(ADMIN_TOKEN_KEY,token); localStorage.setItem(ADMIN_EXP_KEY,String(expiresAt)); }
  function logoutAdmin(){ localStorage.removeItem(ADMIN_TOKEN_KEY); localStorage.removeItem(ADMIN_EXP_KEY); }

  function setRoute(route){ state.route=route; state.group=null; state.adminPanel=null; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  $$('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setRoute(btn.dataset.route)));
  $('#homeBtn').addEventListener('click',()=>setRoute('members'));

  function navActive(){ $$('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.route===state.route)); }
  function render(){ document.body.classList.toggle('admin-route', state.route==='admin'); navActive(); ({members:renderMembers,workContacts:renderWork,stats:renderStats,docs:renderDocs,admin:renderAdmin}[state.route]||renderMembers)(); }

  function memberSearchText(m){ return `${m.name||''} ${m.company||''} ${m.title||''}`.toLowerCase(); }
  function updateMemberGroupArea(){
    const area=$('#memberGroupArea'); if(!area)return;
    const groups=load(KEYS.groups,[]), members=load(KEYS.members,[]), q=state.memberQ.trim().toLowerCase();
    if(q){
      const filtered=members.filter(m=>memberSearchText(m).includes(q));
      area.innerHTML=filtered.length?filtered.map(memberRow).join(''):`<div class="empty">검색 결과가 없습니다.</div>`;
      bindMemberRows();
    }else{
      area.innerHTML=groups.map(g=>`<button class="list-btn" data-group="${esc(g)}"><span><strong>${esc(g)}</strong><div class="muted">${members.filter(m=>(m.groups||[]).includes(g)).length}명</div></span><span class="chev">›</span></button>`).join('')||`<div class="empty">등록된 명단이 없습니다.</div>`;
      $$('[data-group]',area).forEach(b=>b.onclick=()=>{state.group=b.dataset.group;state.memberQ='';renderMembers();});
    }
  }
  function updateMemberListArea(){
    const area=$('#memberListArea'), count=$('#memberCount'); if(!area)return;
    const members=load(KEYS.members,[]), q=state.memberQ.trim().toLowerCase();
    const filtered=members.filter(m=>(m.groups||[]).includes(state.group)&&(!q||memberSearchText(m).includes(q)));
    if(count) count.textContent=`총 ${filtered.length}명`;
    area.innerHTML=filtered.length?filtered.map(memberRow).join(''):`<div class="empty">검색 결과가 없습니다.</div>`;
    bindMemberRows();
  }
  function renderMembers(){
    title.textContent = state.group || '인명부';
    if(!state.group){
      main.innerHTML=`
        <div class="card hero"><strong style="font-size:18px">협회 인명부</strong><div class="muted" style="margin-top:5px">명단을 선택하면 구성원을 바로 확인하고 전화할 수 있습니다.</div></div>
        <div class="search"><input id="memberGlobalQ" placeholder="이름 또는 회사명 검색" value="${esc(state.memberQ)}" autocomplete="off" enterkeyhint="search"></div>
        <div id="memberGroupArea"></div>`;
      updateMemberGroupArea();
      // 입력창 자체를 다시 그리지 않고 결과 영역만 갱신한다.
      // 모바일 한글 IME 조합 중 DOM 교체로 입력이 끊기는 현상을 방지한다.
      $('#memberGlobalQ').addEventListener('input',e=>{state.memberQ=e.target.value;updateMemberGroupArea();});
    } else {
      main.innerHTML=`<button class="secondary" id="backGroups" style="margin-bottom:12px">← 명단 목록</button>
        <div class="search"><input id="memberQ" placeholder="${esc(state.group)} 검색" value="${esc(state.memberQ)}" autocomplete="off" enterkeyhint="search"></div>
        <div class="muted" id="memberCount" style="margin:0 3px 9px"></div>
        <div id="memberListArea"></div>`;
      $('#backGroups').onclick=()=>{state.group=null;state.memberQ='';renderMembers();};
      updateMemberListArea();
      $('#memberQ').addEventListener('input',e=>{state.memberQ=e.target.value;updateMemberListArea();});
    }
  }
  function memberRow(m){ return `<div class="row-card" data-member="${esc(m.id)}"><div class="row-main"><div class="name">${esc(m.name)}</div><div class="sub">${esc(m.company||'')} ${m.title?'· '+esc(m.title):''}</div></div><div class="row-actions">${m.mobile?`<a class="mini-btn" href="tel:${onlyDigits(m.mobile)}" onclick="event.stopPropagation()">📞</a>`:''}<span class="chev">›</span></div></div>`; }
  function bindMemberRows(){ $$('[data-member]').forEach(el=>el.onclick=()=>openMember(el.dataset.member)); }
  function openMember(mid){ const m=load(KEYS.members,[]).find(x=>x.id===mid); if(!m)return;
    detailDialog.innerHTML=`<div class="sheet-inner"><div class="sheet-head"><div><div class="muted">인물 상세</div><h2>${esc(m.name)}</h2><div class="muted">${esc(m.company||'')} ${m.title?'· '+esc(m.title):''}</div></div><button class="close-btn">✕</button></div>
      ${m.mobile?`<div class="detail-line"><b>휴대전화</b>${esc(m.mobile)}</div>`:''}${m.office?`<div class="detail-line"><b>회사전화</b>${esc(m.office)}</div>`:''}${m.email?`<div class="detail-line"><b>이메일</b>${esc(m.email)}</div>`:''}<div class="detail-line"><b>소속 명단</b>${(m.groups||[]).map(g=>`<span class="badge">${esc(g)}</span>`).join(' ')||'-'}</div>${m.note?`<div class="detail-line"><b>비고</b>${esc(m.note)}</div>`:''}
      <div class="call-grid">${m.mobile?`<a class="call-btn" href="tel:${onlyDigits(m.mobile)}">📞 전화</a><a class="call-btn sms-btn" href="sms:${onlyDigits(m.mobile)}">💬 문자</a>`:`<div class="empty" style="grid-column:1/-1">휴대전화가 없습니다.</div>`}</div></div>`;
    $('.close-btn',detailDialog).onclick=()=>detailDialog.close(); detailDialog.showModal();
  }

  function updateWorkResults(){
    const area=$('#workResultArea'); if(!area)return;
    const items=load(KEYS.work,[]), q=state.workQ.trim().toLowerCase();
    const filtered=items.filter(x=>(state.workCategory==='전체'||x.category===state.workCategory)&&(!q||`${x.org||''} ${x.dept||''} ${x.name||''} ${x.title||''} ${x.work||''}`.toLowerCase().includes(q)));
    area.innerHTML=filtered.length?filtered.map(workRow).join(''):`<div class="empty">검색 결과가 없습니다.</div>`;
    $$('[data-work]',area).forEach(el=>el.onclick=()=>openWork(el.dataset.work));
  }
  function renderWork(){
    title.textContent='업무연락처'; const items=load(KEYS.work,[]); const cats=['전체',...new Set(items.map(x=>x.category||'기타'))];
    main.innerHTML=`<div class="card hero"><strong style="font-size:18px">업무 관련 연락처</strong><div class="muted" style="margin-top:5px">기관·부서·담당업무로 검색할 수 있습니다.</div></div>
      <div class="search"><input id="workQ" placeholder="기관·담당자·담당업무 검색" value="${esc(state.workQ)}" autocomplete="off" enterkeyhint="search"></div>
      <div class="chips">${cats.map(c=>`<button class="chip ${c===state.workCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div id="workResultArea"></div>`;
    updateWorkResults();
    $('#workQ').addEventListener('input',e=>{state.workQ=e.target.value;updateWorkResults();});
    $$('[data-cat]').forEach(b=>b.onclick=()=>{state.workCategory=b.dataset.cat;renderWork();});
  }
  function workRow(x){
    const phoneLink=(kind, number)=>{
      const dial=onlyDigits(number||'');
      if(!dial || !/^\+?\d{2,15}$/.test(dial)) return '';
      return `<a class="work-phone-link" href="tel:${dial}" aria-label="${kind} ${esc(number)} 전화 걸기">
        <span class="work-phone-label">${kind==='사무실'?'☎ 사무실':'📱 휴대전화'}</span>
        <strong class="work-phone-number">${esc(number)}</strong>
      </a>`;
    };
    const office=phoneLink('사무실',x.office);
    const mobile=phoneLink('휴대전화',x.mobile);
    return `<div class="row-card work-list-card">
      <button type="button" class="work-list-heading" data-work="${esc(x.id)}" aria-label="${esc(x.org||'업무연락처')} 상세정보 보기">
        <span class="work-list-identity">
          <span class="badge gray">${esc(x.category||'기타')}</span>
          <span class="name">${esc(x.org||'')}</span>
          <span class="sub">${esc(x.dept||'')} ${x.name?'· '+esc(x.name):''} ${x.work?'· '+esc(x.work):''}</span>
        </span>
        <span class="work-list-detail">상세보기 <span aria-hidden="true">›</span></span>
      </button>
      ${(office||mobile)?`<div class="work-list-phones ${office&&mobile?'has-two':''}">${office}${mobile}</div>`:''}
    </div>`;
  }
  function openWork(wid){ const x=load(KEYS.work,[]).find(v=>v.id===wid); if(!x)return;
    const officeCall=x.office?`<a class="call-btn" href="tel:${onlyDigits(x.office)}">☎ 사무실 전화</a>`:'';
    const mobileCall=x.mobile?`<a class="call-btn" href="tel:${onlyDigits(x.mobile)}">📱 휴대전화</a>`:'';
    const smsCall=x.mobile?`<a class="call-btn sms-btn ${x.office?'call-wide':''}" href="sms:${onlyDigits(x.mobile)}">💬 문자 보내기</a>`:'';
    const callActions=(officeCall||mobileCall||smsCall)?`<div class="call-grid">${officeCall}${mobileCall}${smsCall}</div>`:`<div class="empty" style="margin-top:16px">등록된 전화번호가 없습니다.</div>`;
    detailDialog.innerHTML=`<div class="sheet-inner"><div class="sheet-head"><div><div class="muted">${esc(x.category||'업무연락처')}</div><h2>${esc(x.org||'')}</h2><div class="muted">${esc(x.dept||'')} ${x.name?'· '+esc(x.name):''}</div></div><button class="close-btn">✕</button></div>
      ${x.name?`<div class="detail-line"><b>담당자</b>${esc(x.name)} ${esc(x.title||'')}</div>`:''}${x.work?`<div class="detail-line"><b>담당업무</b>${esc(x.work)}</div>`:''}${x.office?`<div class="detail-line"><b>사무실 전화</b>${esc(x.office)}</div>`:''}${x.mobile?`<div class="detail-line"><b>휴대전화</b>${esc(x.mobile)}</div>`:''}${x.email?`<div class="detail-line"><b>이메일</b>${esc(x.email)}</div>`:''}${x.note?`<div class="detail-line"><b>비고</b>${esc(x.note)}</div>`:''}
      ${callActions}</div>`;
    $('.close-btn',detailDialog).onclick=()=>detailDialog.close(); detailDialog.showModal();
  }

  async function renderStats(){
    title.textContent='전문건설현황'; let data=load(KEYS.stats,seedStats); const regions=data.rows.map(r=>r.region); if(!regions.includes(state.statsRegion)) state.statsRegion=regions.includes('인천')?'인천':regions[0]; const row=data.rows.find(r=>r.region===state.statsRegion)||data.total; const industries=row.industries||{}; const max=Math.max(1,...Object.values(industries));
    main.innerHTML=`<div class="card hero"><div class="title-row"><div><strong style="font-size:18px">등록분포현황</strong><div class="muted" style="margin-top:5px">대한전문건설협회 공식자료 기준</div></div><div class="status"><span class="dot ${data.live?'':'warn'}"></span>${data.live?'최신조회':'저장자료'}</div></div></div>
      <div class="card"><div class="field"><label>지역</label><select id="regionSel">${regions.map(r=>`<option ${r===state.statsRegion?'selected':''}>${esc(r)}</option>`).join('')}<option ${state.statsRegion==='전국'?'selected':''}>전국</option></select></div><div class="muted">기준 ${esc(data.period||'-')} · 갱신 ${new Date(data.fetchedAt).toLocaleString('ko-KR')}</div></div>
      <div class="kpi-grid"><div class="kpi"><div class="label">등록 수</div><div class="value">${fmt(row.registrations)}</div></div><div class="kpi"><div class="label">업체 수</div><div class="value">${fmt(row.companies)}</div></div></div>
      <div class="section-title">업종별 현황</div>
      <div class="card">${Object.keys(industries).length?Object.entries(industries).map(([k,v])=>`<div class="bar-row"><div class="bar-head"><span>${esc(k)}</span><strong>${fmt(v)}</strong></div><div class="bar"><i style="width:${Math.max(2,(v/max)*100)}%"></i></div></div>`).join(''):`<div class="empty">현재 지역의 업종별 세부자료는 다음 온라인 동기화 때 표시됩니다.</div>`}</div>
      <button class="primary" id="syncStats">공식자료 새로고침</button><div class="hint" style="margin-top:8px">배포 서버에서 실행하면 공식 홈페이지 최신 자료를 자동으로 가져옵니다. 로컬 파일로 열었을 때는 저장된 공식자료를 표시합니다.</div>`;
    $('#regionSel').onchange=e=>{ state.statsRegion=e.target.value; if(state.statsRegion==='전국'){ const d=load(KEYS.stats,seedStats); d.rows=[...d.rows]; state.statsRegion='전국'; const temp=d.total; main.dataset._x=''; renderStatsTotal(d,temp); } else renderStats(); };
    $('#syncStats').onclick=syncStats;
  }
  function renderStatsTotal(data,row){
    title.textContent='전문건설현황'; const industries=row.industries||{}; const max=Math.max(1,...Object.values(industries));
    main.innerHTML=`<div class="card hero"><strong style="font-size:18px">등록분포현황 · 전국</strong><div class="muted" style="margin-top:5px">대한전문건설협회 공식자료 기준</div></div><button class="secondary" id="backIncheon" style="margin-bottom:12px">← 지역 선택으로 돌아가기</button><div class="kpi-grid"><div class="kpi"><div class="label">등록 수</div><div class="value">${fmt(row.registrations)}</div></div><div class="kpi"><div class="label">업체 수</div><div class="value">${fmt(row.companies)}</div></div></div><div class="section-title">업종별 현황</div><div class="card">${Object.entries(industries).map(([k,v])=>`<div class="bar-row"><div class="bar-head"><span>${esc(k)}</span><strong>${fmt(v)}</strong></div><div class="bar"><i style="width:${Math.max(2,(v/max)*100)}%"></i></div></div>`).join('')}</div><button class="primary" id="syncStats">공식자료 새로고침</button>`;
    $('#backIncheon').onclick=()=>{state.statsRegion='인천';renderStats();}; $('#syncStats').onclick=syncStats;
  }
  async function syncStats(){
    const btn=$('#syncStats'); if(btn){btn.disabled=true;btn.textContent='공식자료 확인 중…';}
    try{
      const res=await fetch('/api/kosca',{cache:'no-store'}); if(!res.ok) throw new Error('API '+res.status); const data=await res.json(); data.live=true; save(KEYS.stats,data); toast('공식자료를 최신화했습니다.'); renderStats();
    }catch(e){ toast('로컬 실행 중이거나 서버 연동 전입니다. 저장자료를 사용합니다.'); if(btn){btn.disabled=false;btn.textContent='공식자료 새로고침';} }
  }

  // Supabase 공용 PDF 자료실
  async function docsAll(){ const r=await api('?resource=documents'); return Array.isArray(r.items)?r.items:[]; }
  async function docPut(doc){ return api(`?resource=document&id=${encodeURIComponent(doc.id)}`,{method:'PATCH',body:JSON.stringify({title:doc.title,category:doc.category,baseDate:doc.baseDate,description:doc.description})},true); }
  async function docDelete(did){ return api(`?resource=document&id=${encodeURIComponent(did)}`,{method:'DELETE'},true); }
  async function renderDocs(){
    title.textContent='자료실';
    let docs=[];
    try{docs=await docsAll();}catch(e){main.innerHTML=`<div class="empty">자료실을 불러오지 못했습니다.<br><span class="small">${esc(e.message)}</span></div>`;return;}
    const cats=['전체',...new Set(docs.map(d=>d.category||'기타'))];
    main.innerHTML=`<div class="card hero"><strong style="font-size:18px">PDF 자료실</strong><div class="muted" style="margin-top:5px">공용 자료실의 PDF를 휴대폰에서 바로 열람합니다.</div></div><div class="search"><input id="docQ" placeholder="문서명 검색" value="${esc(state.docQ)}" autocomplete="off" enterkeyhint="search"></div><div class="chips">${cats.map(c=>`<button class="chip ${c===state.docCategory?'active':''}" data-doccat="${esc(c)}">${esc(c)}</button>`).join('')}</div><div id="docResultArea"></div>`;
    const update=()=>{
      const area=$('#docResultArea'); if(!area)return;
      const q=state.docQ.trim().toLowerCase();
      const filtered=docs.filter(d=>(state.docCategory==='전체'||d.category===state.docCategory)&&(!q||`${d.title||''} ${d.category||''} ${d.description||''}`.toLowerCase().includes(q)));
      area.innerHTML=filtered.length?filtered.map(d=>`<div class="row-card" data-doc="${esc(d.id)}"><div class="row-main"><div><span class="badge gray">${esc(d.category||'기타')}</span></div><div class="name" style="margin-top:5px">${esc(d.title)}</div><div class="sub">${esc(d.baseDate||'')} ${d.fileName?'· '+esc(d.fileName):''}</div></div><span class="chev">›</span></div>`).join(''):`<div class="empty">등록된 PDF가 없습니다.<br><span class="small">PC 관리자 화면에서 PDF를 업로드해 주세요.</span></div>`;
      $$('[data-doc]',area).forEach(el=>el.onclick=()=>openDoc(el.dataset.doc));
    };
    update();
    $('#docQ').addEventListener('input',e=>{state.docQ=e.target.value;update();});
    $$('[data-doccat]').forEach(b=>b.onclick=()=>{state.docCategory=b.dataset.doccat;renderDocs();});
  }
  async function openDoc(did){
    try{
      const r=await api(`?action=pdf-view&id=${encodeURIComponent(did)}`);
      pdfDialog.innerHTML=`<div class="pdf-wrap"><div class="pdf-head"><strong>${esc(r.title||'PDF')}</strong><button class="close-btn">✕</button></div><iframe class="pdf-frame" src="${esc(r.url)}#toolbar=1&navpanes=0"></iframe></div>`;
      $('.close-btn',pdfDialog).onclick=()=>pdfDialog.close(); pdfDialog.showModal();
    }catch(e){toast(e.message||'PDF를 열지 못했습니다.');}
  }

  function renderAdmin(){
    title.textContent='관리';
    if(!adminOK()){
      main.innerHTML=`<div class="card hero"><strong style="font-size:18px">관리자 인증</strong><div class="muted" style="margin-top:5px">일반 사용자는 로그인 없이 이용합니다.</div></div><div class="card"><div class="field"><label>관리자 비밀번호</label><input id="adminPin" type="password" maxlength="50" placeholder="Netlify에 등록한 관리자 비밀번호"></div><button class="primary" id="adminLogin">관리자 페이지 열기</button><div class="hint" style="margin-top:10px">비밀번호는 앱 안이 아니라 Netlify 서버에서 확인합니다.</div></div>`;
      const login=async()=>{const val=$('#adminPin').value; if(!val)return toast('비밀번호를 입력해 주세요.'); const btn=$('#adminLogin');btn.disabled=true;btn.textContent='확인 중…';try{const r=await api('?action=login',{method:'POST',body:JSON.stringify({password:val})});setAdmin(r.token,r.expiresAt);log('관리자 모드 접속');toast('관리자 모드가 열렸습니다.');await refreshSharedData(false);renderAdmin();}catch(e){toast(e.message||'비밀번호가 일치하지 않습니다.');btn.disabled=false;btn.textContent='관리자 페이지 열기';}};
      $('#adminLogin').onclick=login; $('#adminPin').addEventListener('keydown',e=>{if(e.key==='Enter')login();}); return;
    }
    if(state.adminPanel){ renderAdminPanel(state.adminPanel); return; }
    main.innerHTML=`<div class="card hero"><div class="title-row"><div><strong style="font-size:18px">관리자 페이지</strong><div class="muted" style="margin-top:5px">PC에서 수정한 내용이 공용 DB에 저장됩니다.</div></div><span class="badge" style="background:white">공용DB</span></div></div>
      <button class="secondary" id="dbRefresh" style="margin-bottom:12px">↻ 공용 DB 최신자료 다시 불러오기</button>
      ${adminTile('members','👥','인명부 관리','엑셀 업로드 / 표 직접 수정')}${adminTile('work','☎️','업무연락처 관리','엑셀 업로드 / 표 직접 수정')}${adminTile('docs','📚','PDF 자료 관리','공용 PDF 등록 / 수정 / 삭제')}${adminTile('stats','📊','전문건설현황 관리','공식자료 동기화')}${adminTile('logs','📝','관리기록','이 기기의 최근 작업 확인')}${adminTile('pin','🔐','관리자 비밀번호 설정','Netlify 환경변수에서 변경')}
      <button class="danger" id="adminLogout" style="margin-top:10px">관리자 모드 종료</button>`;
    $('#dbRefresh').onclick=()=>refreshSharedData(true); $$('[data-admin]').forEach(x=>x.onclick=()=>{state.adminPanel=x.dataset.admin;renderAdmin();}); $('#adminLogout').onclick=()=>{logoutAdmin();toast('관리자 모드를 종료했습니다.');renderAdmin();};
  }

  function adminTile(key,icon,name,sub){return `<button class="admin-tile" data-admin="${key}"><span style="display:flex;align-items:center;gap:12px"><span style="font-size:24px">${icon}</span><span><strong>${name}</strong><small>${sub}</small></span></span><span class="chev">›</span></button>`;}
  function adminBack(){ state.adminPanel=null; renderAdmin(); }
  async function renderAdminPanel(p){
    const back=`<button class="secondary" id="adminBack" style="margin-bottom:12px">← 관리자 홈</button>`;
    if(p==='members') adminMembers(back); else if(p==='work') adminWork(back); else if(p==='docs') await adminDocs(back); else if(p==='stats') adminStats(back); else if(p==='logs') adminLogs(back); else if(p==='pin') adminPin(back);
    const backBtn=$('#adminBack'); if(backBtn) backBtn.onclick=adminBack;
  }
  function adminMembers(back){
    const groups=load(KEYS.groups,[]), members=load(KEYS.members,[]);
    main.innerHTML=back+`<div class="pc-admin-grid">
      <div class="card admin-import-card"><h3 style="margin-top:0">인명부 엑셀 업로드</h3>
        <div class="field"><label>명단명</label><input id="groupName" placeholder="예: 대표회원"></div>
        <div class="field"><label>엑셀/CSV 파일</label><input id="memberFile" type="file" accept=".xlsx,.xls,.csv"></div>
        <div class="hint">권장 열: 성명, 회사명, 직위, 휴대전화, 일반전화, 이메일, 비고. 동일 성명+회사명은 기존 정보를 갱신합니다.</div>
        <button class="primary" id="importMembers" style="margin-top:12px">명단 가져오기</button>
      </div>
      <div class="card admin-summary-card"><div class="title-row"><strong>현재 인명부</strong><span class="count">${members.length}명 / ${groups.length}개 명단</span></div>
        <div class="hint" style="margin-top:8px">명단: ${groups.map(esc).join(', ')||'-'}</div>
        <div class="admin-actions"><button class="secondary" id="addMemberRow">+ 새 행 추가</button><button class="secondary" id="exportMembers">엑셀로 내보내기</button><button class="primary" id="saveMemberTable">표 전체 저장</button></div>
      </div>
    </div>
    <div class="card pc-editor-card">
      <div class="editor-toolbar"><div><h3>인명부 직접 수정</h3><div class="hint">PC에서는 아래 표의 셀을 클릭해서 바로 수정할 수 있습니다.</div></div>
        <div class="editor-filters"><input id="memberAdminQ" placeholder="이름·회사 검색"><select id="memberAdminGroup"><option value="전체">전체 명단</option>${groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></div>
      </div>
      <div class="table-wrap"><table class="admin-table"><thead><tr><th>성명</th><th>회사명</th><th>직위</th><th>휴대전화</th><th>일반전화</th><th>이메일</th><th>소속명단</th><th>비고</th><th></th></tr></thead><tbody id="memberEditorBody"></tbody></table></div>
    </div>
    <button class="danger danger-compact" id="resetMembers">인명부 전체 비우기</button>`;
    $('#importMembers').onclick=importMembers;
    $('#addMemberRow').onclick=()=>{ const arr=load(KEYS.members,[]); arr.unshift({id:id('m'),name:'',company:'',title:'',mobile:'',office:'',email:'',groups:[],note:''}); save(KEYS.members,arr); renderMemberEditor(); };
    $('#saveMemberTable').onclick=saveMemberEditor;
    $('#exportMembers').onclick=exportMembersExcel;
    $('#memberAdminQ').oninput=renderMemberEditor; $('#memberAdminGroup').onchange=renderMemberEditor;
    $('#resetMembers').onclick=async()=>{if(confirm('인명부를 모두 비울까요? 이 작업은 모든 휴대폰에 반영됩니다.')){save(KEYS.members,[]);save(KEYS.groups,[]);try{await pushMembers();log('인명부 전체 비우기');toast('공용 인명부를 비웠습니다.');adminMembers(`<button class="secondary" id="adminBack" style="margin-bottom:12px">← 관리자 홈</button>`);$('#adminBack').onclick=adminBack;}catch(e){toast(e.message);}}};
    renderMemberEditor();
  }
  function renderMemberEditor(){
    const body=$('#memberEditorBody'); if(!body)return; const members=load(KEYS.members,[]); const q=($('#memberAdminQ')?.value||'').trim().toLowerCase(); const g=$('#memberAdminGroup')?.value||'전체';
    const filtered=members.filter(m=>(g==='전체'||(m.groups||[]).includes(g))&&(!q||`${m.name} ${m.company} ${m.title} ${(m.groups||[]).join(' ')}`.toLowerCase().includes(q)));
    body.innerHTML=filtered.length?filtered.map(m=>`<tr data-edit-member="${esc(m.id)}"><td><input data-k="name" value="${esc(m.name)}"></td><td><input data-k="company" value="${esc(m.company||'')}"></td><td><input data-k="title" value="${esc(m.title||'')}"></td><td><input data-k="mobile" value="${esc(m.mobile||'')}"></td><td><input data-k="office" value="${esc(m.office||'')}"></td><td><input data-k="email" value="${esc(m.email||'')}"></td><td><input data-k="groups" value="${esc((m.groups||[]).join(', '))}" placeholder="대표회원, 운영위원"></td><td><input data-k="note" value="${esc(m.note||'')}"></td><td><button class="table-delete" data-del-member="${esc(m.id)}">삭제</button></td></tr>`).join(''):`<tr><td colspan="9" class="table-empty">표시할 인원이 없습니다.</td></tr>`;
    $$('[data-del-member]',body).forEach(b=>b.onclick=async()=>{if(confirm('이 인물을 삭제할까요?')){save(KEYS.members,load(KEYS.members,[]).filter(x=>x.id!==b.dataset.delMember));try{await pushMembers();log('인명부 인물 삭제');renderMemberEditor();}catch(e){toast(e.message);}}});
  }
  async function saveMemberEditor(){
    let members=load(KEYS.members,[]); let groups=load(KEYS.groups,[]); const byId=new Map(members.map(m=>[m.id,m]));
    $$('tr[data-edit-member]').forEach(tr=>{ const m=byId.get(tr.dataset.editMember); if(!m)return; $$('[data-k]',tr).forEach(inp=>{ const k=inp.dataset.k; if(k==='groups'){m.groups=inp.value.split(',').map(v=>v.trim()).filter(Boolean); m.groups.forEach(g=>{if(!groups.includes(g))groups.push(g);});} else m[k]=inp.value.trim(); }); });
    members=members.filter(m=>m.name||m.company||m.mobile||m.office); save(KEYS.members,members); save(KEYS.groups,groups);
    try{await pushMembers();log('인명부 표 직접 수정 저장');toast('공용 인명부에 저장했습니다.');adminMembers(`<button class="secondary" id="adminBack" style="margin-bottom:12px">← 관리자 홈</button>`);$('#adminBack').onclick=adminBack;}catch(e){toast(e.message||'공용 DB 저장에 실패했습니다.');}
  }

  function exportMembersExcel(){
    if(typeof XLSX==='undefined')return toast('엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
    const rows=load(KEYS.members,[]).map(m=>({'성명':m.name||'','회사명':m.company||'','직위':m.title||'','휴대전화':m.mobile||'','일반전화':m.office||'','이메일':m.email||'','소속명단':(m.groups||[]).join(', '),'비고':m.note||''}));
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'인명부'); XLSX.writeFile(wb,`인명부_${new Date().toISOString().slice(0,10)}.xlsx`); log('인명부 엑셀 내보내기');
  }
  function adminWork(back){
    const work=load(KEYS.work,[]); main.innerHTML=back+`<div class="pc-admin-grid">
      <div class="card admin-import-card"><h3 style="margin-top:0">업무연락처 엑셀 업로드</h3><div class="field"><label>엑셀/CSV 파일</label><input id="workFile" type="file" accept=".xlsx,.xls,.csv"></div><div class="hint">권장 열: 분류, 기관명, 부서명, 담당자, 직위, 담당업무, 사무실전화, 휴대전화, 이메일, 비고.</div><button class="primary" id="importWork" style="margin-top:12px">업무연락처 가져오기</button></div>
      <div class="card admin-summary-card"><div class="title-row"><strong>현재 업무연락처</strong><span class="count">${work.length}건</span></div><div class="admin-actions"><button class="secondary" id="addWorkRow">+ 새 행 추가</button><button class="secondary" id="exportWork">엑셀로 내보내기</button><button class="primary" id="saveWorkTable">표 전체 저장</button></div></div>
    </div>
    <div class="card pc-editor-card"><div class="editor-toolbar"><div><h3>업무연락처 직접 수정</h3><div class="hint">기관명·부서·담당업무·전화번호를 셀에서 직접 수정합니다.</div></div><div class="editor-filters"><input id="workAdminQ" placeholder="기관·담당자·업무 검색"></div></div>
      <div class="table-wrap"><table class="admin-table work-table"><thead><tr><th>분류</th><th>기관명</th><th>부서명</th><th>담당자</th><th>직위</th><th>담당업무</th><th>사무실전화</th><th>휴대전화</th><th>이메일</th><th>비고</th><th></th></tr></thead><tbody id="workEditorBody"></tbody></table></div></div>
    <button class="danger danger-compact" id="resetWork">업무연락처 전체 비우기</button>`;
    $('#importWork').onclick=importWork; $('#addWorkRow').onclick=()=>{const arr=load(KEYS.work,[]);arr.unshift({id:id('w'),category:'',org:'',dept:'',name:'',title:'',work:'',office:'',mobile:'',email:'',note:''});save(KEYS.work,arr);renderWorkEditor();}; $('#saveWorkTable').onclick=saveWorkEditor; $('#exportWork').onclick=exportWorkExcel; $('#workAdminQ').oninput=renderWorkEditor;
    $('#resetWork').onclick=async()=>{if(confirm('업무연락처를 모두 비울까요? 이 작업은 모든 휴대폰에 반영됩니다.')){save(KEYS.work,[]);try{await pushWork();log('업무연락처 전체 비우기');toast('공용 업무연락처를 비웠습니다.');adminBack();}catch(e){toast(e.message);}}}; renderWorkEditor();
  }
  function renderWorkEditor(){ const body=$('#workEditorBody'); if(!body)return; const q=($('#workAdminQ')?.value||'').trim().toLowerCase(); const rows=load(KEYS.work,[]).filter(x=>!q||`${x.category} ${x.org} ${x.dept} ${x.name} ${x.title} ${x.work}`.toLowerCase().includes(q));
    const keys=['category','org','dept','name','title','work','office','mobile','email','note']; body.innerHTML=rows.length?rows.map(x=>`<tr data-edit-work="${esc(x.id)}">${keys.map(k=>`<td><input data-k="${k}" value="${esc(x[k]||'')}"></td>`).join('')}<td><button class="table-delete" data-del-work="${esc(x.id)}">삭제</button></td></tr>`).join(''):`<tr><td colspan="11" class="table-empty">표시할 연락처가 없습니다.</td></tr>`; $$('[data-del-work]',body).forEach(b=>b.onclick=async()=>{if(confirm('이 연락처를 삭제할까요?')){save(KEYS.work,load(KEYS.work,[]).filter(x=>x.id!==b.dataset.delWork));try{await pushWork();log('업무연락처 삭제');renderWorkEditor();}catch(e){toast(e.message);}}}); }
  async function saveWorkEditor(){ const arr=load(KEYS.work,[]); const byId=new Map(arr.map(x=>[x.id,x])); $$('tr[data-edit-work]').forEach(tr=>{const x=byId.get(tr.dataset.editWork);if(!x)return;$$('[data-k]',tr).forEach(inp=>x[inp.dataset.k]=inp.value.trim());}); save(KEYS.work,arr.filter(x=>x.org||x.name||x.office||x.mobile)); try{await pushWork();log('업무연락처 표 직접 수정 저장');toast('공용 업무연락처에 저장했습니다.');adminWork(`<button class="secondary" id="adminBack" style="margin-bottom:12px">← 관리자 홈</button>`); $('#adminBack').onclick=adminBack;}catch(e){toast(e.message||'공용 DB 저장에 실패했습니다.');} }

  function exportWorkExcel(){ if(typeof XLSX==='undefined')return toast('엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); const rows=load(KEYS.work,[]).map(x=>({'분류':x.category||'','기관명':x.org||'','부서명':x.dept||'','담당자':x.name||'','직위':x.title||'','담당업무':x.work||'','사무실전화':x.office||'','휴대전화':x.mobile||'','이메일':x.email||'','비고':x.note||''})); const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'업무연락처');XLSX.writeFile(wb,`업무연락처_${new Date().toISOString().slice(0,10)}.xlsx`);log('업무연락처 엑셀 내보내기'); }
  async function adminDocs(back){
    const docs=await docsAll(); main.innerHTML=back+`<div class="pc-admin-grid"><div class="card"><h3 style="margin-top:0">PDF 등록</h3><div class="field"><label>제목</label><input id="pdfTitle" placeholder="문서 제목"></div><div class="field"><label>분류</label><input id="pdfCategory" placeholder="예: 업무자료, 법령, 회의자료"></div><div class="field"><label>기준일</label><input id="pdfDate" type="date"></div><div class="field"><label>설명</label><textarea id="pdfDesc" rows="2"></textarea></div><div class="field"><label>PDF 파일</label><input id="pdfFile" type="file" accept="application/pdf,.pdf"></div><button class="primary" id="addPdf">PDF 등록</button></div>
      <div class="card"><div class="title-row"><strong>등록 자료</strong><span class="count">${docs.length}개</span></div><div class="hint" style="margin-top:8px">PC에서는 문서 제목·분류·기준일·설명을 바로 수정할 수 있습니다.</div><button class="primary" id="saveDocMeta" style="margin-top:12px">PDF 정보 전체 저장</button></div></div>
      <div class="card pc-editor-card"><div class="table-wrap"><table class="admin-table doc-table"><thead><tr><th>제목</th><th>분류</th><th>기준일</th><th>설명</th><th>파일명</th><th>보기</th><th>삭제</th></tr></thead><tbody>${docs.length?docs.map(d=>`<tr data-edit-doc="${esc(d.id)}"><td><input data-k="title" value="${esc(d.title)}"></td><td><input data-k="category" value="${esc(d.category||'')}"></td><td><input data-k="baseDate" type="date" value="${esc(d.baseDate||'')}"></td><td><input data-k="description" value="${esc(d.description||'')}"></td><td class="file-cell">${esc(d.fileName||'')}</td><td><button class="table-view" data-view-doc="${esc(d.id)}">보기</button></td><td><button class="table-delete" data-delpdf="${esc(d.id)}">삭제</button></td></tr>`).join(''):`<tr><td colspan="7" class="table-empty">등록된 PDF가 없습니다.</td></tr>`}</tbody></table></div></div>`;
    $('#addPdf').onclick=addPdf; $('#saveDocMeta').onclick=saveDocMeta; $$('[data-view-doc]').forEach(b=>b.onclick=()=>openDoc(b.dataset.viewDoc)); $$('[data-delpdf]').forEach(b=>b.onclick=async()=>{if(confirm('이 PDF를 삭제할까요?')){await docDelete(b.dataset.delpdf);log('PDF 삭제');toast('삭제했습니다.');adminDocs(`<button class="secondary" id="adminBack" style="margin-bottom:12px">← 관리자 홈</button>`);$('#adminBack').onclick=adminBack;}});
  }
  async function saveDocMeta(){ const docs=await docsAll(); const byId=new Map(docs.map(d=>[d.id,d])); for(const tr of $$('tr[data-edit-doc]')){const d=byId.get(tr.dataset.editDoc);if(!d)continue;$$('[data-k]',tr).forEach(inp=>d[inp.dataset.k]=inp.value.trim());await docPut(d);} log('PDF 문서정보 수정 저장'); toast('PDF 문서정보를 저장했습니다.'); }
  function adminStats(back){ const d=load(KEYS.stats,seedStats); main.innerHTML=back+`<div class="card"><h3 style="margin-top:0">전문건설현황 동기화</h3><div class="detail-line"><b>현재 기준</b>${esc(d.period||'-')}</div><div class="detail-line"><b>최근 갱신</b>${new Date(d.fetchedAt).toLocaleString('ko-KR')}</div><div class="detail-line"><b>출처</b>대한전문건설협회 등록분포현황</div><button class="primary" id="adminSync" style="margin-top:14px">지금 공식자료 동기화</button><div class="hint" style="margin-top:8px">배포 서버의 /api/kosca 기능을 통해 공식 홈페이지에서 최신값을 읽습니다.</div></div>`; $('#adminSync').onclick=syncStats;
  }
  function adminLogs(back){ const logs=load(KEYS.logs,[]); main.innerHTML=back+`<div class="card"><h3 style="margin-top:0">관리기록</h3>${logs.length?logs.map(l=>`<div class="detail-line"><b>${new Date(l.at).toLocaleString('ko-KR')}</b>${esc(l.action)}</div>`).join(''):`<div class="empty">기록이 없습니다.</div>`}</div>`; }
  function adminPin(back){ main.innerHTML=back+`<div class="card"><h3 style="margin-top:0">관리자 비밀번호 설정</h3><div class="detail-line"><b>현재 방식</b>관리자 비밀번호는 Netlify 환경변수에서 서버가 확인합니다.</div><div class="hint" style="margin-top:12px">비밀번호를 바꾸려면 Netlify → Project configuration → Environment variables에서 <b>admin_password</b> 또는 <b>ADMIN_PASSWORD</b> 값을 변경한 뒤 사이트를 다시 배포해 주세요.</div></div>`; }


  async function fileRows(file){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext==='csv'){
      const text=await file.text(); return parseCSV(text);
    }
    if(typeof XLSX==='undefined') throw new Error('엑셀 분석 라이브러리를 불러오지 못했습니다. 인터넷 연결 후 다시 시도하거나 CSV로 저장해 주세요.');
    const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws,{defval:''});
  }
  function parseCSV(text){ const rows=[]; let row=[],cell='',q=false; for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1]; if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;} if(cell||row.length){row.push(cell);rows.push(row);} if(!rows.length)return[]; const heads=rows.shift().map(h=>h.trim()); return rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]??'']))); }
  const pick=(o,names)=>{for(const n of names){if(Object.prototype.hasOwnProperty.call(o,n)&&String(o[n]).trim()!=='')return String(o[n]).trim();}return'';};
  async function importMembers(){ const g=$('#groupName').value.trim(), f=$('#memberFile').files[0]; if(!g)return toast('명단명을 입력해 주세요.'); if(!f)return toast('엑셀 파일을 선택해 주세요.'); try{const rows=await fileRows(f); if(!rows.length)return toast('읽을 데이터가 없습니다.'); let members=load(KEYS.members,[]),groups=load(KEYS.groups,[]); if(!groups.includes(g))groups.push(g); let add=0,upd=0,skip=0; for(const r of rows){const name=pick(r,['성명','이름','대표자명','담당자']);const company=pick(r,['회사명','업체명','상호','기관명']);if(!name){skip++;continue;}let m=members.find(x=>x.name===name&&x.company===company);const vals={name,company,title:pick(r,['직위','직책']),mobile:pick(r,['휴대전화','휴대폰','핸드폰','전화번호']),office:pick(r,['일반전화','회사전화','사무실전화']),email:pick(r,['이메일','E-mail','EMAIL']),note:pick(r,['비고','메모'])};if(m){Object.assign(m,vals);m.groups=[...new Set([...(m.groups||[]),g])];upd++;}else{members.push({id:id('m'),...vals,groups:[g]});add++;}} save(KEYS.members,members);save(KEYS.groups,groups);await pushMembers();log(`인명부 엑셀 업로드: ${g} / 신규 ${add}, 수정 ${upd}`);toast(`공용 DB 저장 완료: 신규 ${add}명, 수정 ${upd}명${skip?`, 제외 ${skip}행`:''}`);adminBack();}catch(e){toast(e.message||'엑셀 파일을 읽거나 저장하지 못했습니다.');}}
  async function importWork(){ const f=$('#workFile').files[0]; if(!f)return toast('엑셀 파일을 선택해 주세요.'); try{const rows=await fileRows(f);let work=load(KEYS.work,[]),add=0,upd=0,skip=0;for(const r of rows){const org=pick(r,['기관명','기관','회사명','업체명']);const name=pick(r,['담당자','성명','이름']);const dept=pick(r,['부서명','부서']);if(!org&&!name){skip++;continue;}let x=work.find(v=>v.org===org&&v.dept===dept&&v.name===name);const vals={category:pick(r,['분류','구분'])||'기타',org,dept,name,title:pick(r,['직위','직책']),work:pick(r,['담당업무','업무','업무내용']),office:pick(r,['사무실전화','일반전화','전화']),mobile:pick(r,['휴대전화','휴대폰','핸드폰']),email:pick(r,['이메일','E-mail','EMAIL']),note:pick(r,['비고','메모'])};if(x){Object.assign(x,vals);upd++;}else{work.push({id:id('w'),...vals});add++;}}save(KEYS.work,work);await pushWork();log(`업무연락처 엑셀 업로드: 신규 ${add}, 수정 ${upd}`);toast(`공용 DB 저장 완료: 신규 ${add}건, 수정 ${upd}건${skip?`, 제외 ${skip}행`:''}`);adminBack();}catch(e){toast(e.message||'엑셀 파일을 읽거나 저장하지 못했습니다.');}}
  async function addPdf(){ const f=$('#pdfFile').files[0], t=$('#pdfTitle').value.trim(); if(!t)return toast('제목을 입력해 주세요.'); if(!f)return toast('PDF 파일을 선택해 주세요.'); if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return toast('PDF 파일만 등록할 수 있습니다.'); const btn=$('#addPdf');btn.disabled=true;btn.textContent='PDF 업로드 중…'; try{const init=await api('?action=pdf-init',{method:'POST',body:JSON.stringify({fileName:f.name})},true); const fd=new FormData(); fd.append('cacheControl','3600'); fd.append('',f); const up=await fetch(init.signedUrl,{method:'PUT',headers:{'x-upsert':'false'},body:fd}); if(!up.ok){let msg='';try{msg=await up.text();}catch{} throw new Error('PDF 파일 업로드 실패 '+up.status+(msg?': '+msg.slice(0,120):''));} await api('?action=pdf-complete',{method:'POST',body:JSON.stringify({title:t,category:$('#pdfCategory').value.trim()||'기타',baseDate:$('#pdfDate').value,description:$('#pdfDesc').value.trim(),fileName:f.name,filePath:init.path})},true);log(`PDF 등록: ${t}`);toast('공용 PDF 자료실에 등록했습니다.');adminBack();}catch(e){toast(e.message||'PDF 등록에 실패했습니다.');btn.disabled=false;btn.textContent='PDF 등록';} }


  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
  refreshSharedData(false);
})();
