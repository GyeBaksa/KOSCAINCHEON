const crypto = require('crypto');

const envAny = (...names) => {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return '';
};

const SUPABASE_URL = () => envAny('SUPABASE_URL','KOSCA_INCHEON','kosca_incheon');
const SUPABASE_KEY = () => envAny('SUPABASE_SECRET_KEY','SECRET_KEY','secret_key');
const ADMIN_PASSWORD = () => envAny('ADMIN_PASSWORD','admin_password');
const SESSION_SECRET = () => envAny('ADMIN_SESSION_SECRET','admin_session_secret');
const BUCKET = 'documents';

const json = (statusCode, body, extra={}) => ({
  statusCode,
  headers: {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    ...extra
  },
  body: JSON.stringify(body)
});

function assertConfig() {
  const missing=[];
  if(!SUPABASE_URL()) missing.push('SUPABASE_URL (또는 kosca_incheon)');
  if(!SUPABASE_KEY()) missing.push('SUPABASE_SECRET_KEY (또는 secret_key)');
  if(!ADMIN_PASSWORD()) missing.push('ADMIN_PASSWORD (또는 admin_password)');
  if(!SESSION_SECRET()) missing.push('ADMIN_SESSION_SECRET (또는 admin_session_secret)');
  if(missing.length) throw new Error('환경변수 누락: '+missing.join(', '));
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}
function signToken(exp) {
  const payload=b64url(JSON.stringify({exp,scope:'admin'}));
  const sig=crypto.createHmac('sha256',SESSION_SECRET()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(token) {
  if(!token || !token.includes('.')) return false;
  const [payload,sig]=token.split('.');
  const want=crypto.createHmac('sha256',SESSION_SECRET()).update(payload).digest('base64url');
  try {
    const a=Buffer.from(sig); const b=Buffer.from(want);
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return false;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return data.scope==='admin' && Number(data.exp)>Date.now();
  } catch { return false; }
}
function authToken(event) {
  const h=event.headers.authorization || event.headers.Authorization || '';
  return h.startsWith('Bearer ')?h.slice(7):'';
}
function requireAdmin(event) {
  if(!verifyToken(authToken(event))) {
    const e=new Error('관리자 인증이 필요합니다.'); e.status=401; throw e;
  }
}

function sbHeaders(extra={}) {
  return { 'apikey': SUPABASE_KEY(), ...extra };
}
async function sbFetch(path, opts={}) {
  const url=SUPABASE_URL().replace(/\/$/,'')+path;
  const res=await fetch(url,{...opts,headers:sbHeaders(opts.headers||{})});
  const txt=await res.text();
  let data=null; try{data=txt?JSON.parse(txt):null;}catch{data=txt;}
  if(!res.ok){ const msg=(data&&data.message)||data||`${res.status}`; throw new Error(`Supabase ${res.status}: ${msg}`); }
  return {res,data};
}

function mapMemberFromDb(r){
  return {
    id:String(r.id), name:r.name||'', company:r.company||'', title:r.position||'',
    mobile:r.mobile||'', office:r.phone||'', email:r.email||'', note:r.note||'',
    groups:String(r.group_name||'').split(',').map(x=>x.trim()).filter(Boolean)
  };
}
function mapMemberToDb(m,i){
  return {
    group_name:(m.groups||[]).join(', '), name:m.name||'', company:m.company||'', position:m.title||'',
    mobile:m.mobile||'', phone:m.office||'', email:m.email||'', note:m.note||'', sort_order:i
  };
}
function mapWorkFromDb(r){
  return {id:String(r.id),category:r.category||'',org:r.organization||'',dept:r.department||'',name:r.person_name||'',title:r.position||'',work:r.task||'',office:r.office_phone||'',mobile:r.mobile||'',email:r.email||'',note:r.note||''};
}
function mapWorkToDb(x,i){
  return {category:x.category||'',organization:x.org||'',department:x.dept||'',person_name:x.name||'',position:x.title||'',task:x.work||'',office_phone:x.office||'',mobile:x.mobile||'',email:x.email||'',note:x.note||'',sort_order:i};
}
function mapDocFromDb(r){
  return {id:String(r.id),title:r.title||'',category:r.category||'기타',baseDate:r.reference_date||'',description:r.description||'',fileName:r.file_name||'',filePath:r.file_path||'',createdAt:r.created_at||''};
}
async function addLog(action,target='',detail=''){
  try{
    await sbFetch('/rest/v1/admin_logs',{method:'POST',headers:{'content-type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({action,target,detail})});
  }catch{}
}
async function replaceTable(table, rows){
  await sbFetch(`/rest/v1/${table}?id=gt.0`,{method:'DELETE',headers:{'Prefer':'return=minimal'}});
  if(rows.length){
    await sbFetch(`/rest/v1/${table}`,{method:'POST',headers:{'content-type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(rows)});
  }
}
function safePathName(name='file.pdf'){
  const ext=(name.toLowerCase().endsWith('.pdf')?'.pdf':'');
  const base=name.replace(/\.pdf$/i,'').normalize('NFKC').replace(/[^a-zA-Z0-9가-힣._-]+/g,'_').slice(0,70)||'document';
  return `${Date.now()}_${crypto.randomBytes(5).toString('hex')}_${base}${ext}`;
}
async function createSignedUpload(path){
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  const {data}=await sbFetch(`/storage/v1/object/upload/sign/${BUCKET}/${encoded}`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  const rel=data.url || data.signedURL || data.signedUrl;
  if(!rel) throw new Error('업로드 서명 URL을 만들지 못했습니다.');
  const signedUrl=rel.startsWith('http')?rel:SUPABASE_URL().replace(/\/$/,'')+'/storage/v1'+rel;
  return {signedUrl,path,token:new URL(signedUrl).searchParams.get('token')||''};
}
async function createSignedView(path, expiresIn=3600){
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  const {data}=await sbFetch(`/storage/v1/object/sign/${BUCKET}/${encoded}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expiresIn})});
  const rel=data.signedURL || data.signedUrl;
  if(!rel) throw new Error('PDF 열람 주소를 만들지 못했습니다.');
  return rel.startsWith('http')?rel:SUPABASE_URL().replace(/\/$/,'')+'/storage/v1'+rel;
}
async function deleteStorage(path){
  if(!path) return;
  await sbFetch(`/storage/v1/object/${BUCKET}`,{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({prefixes:[path]})});
}

exports.handler = async (event) => {
  try {
    assertConfig();
    const method=event.httpMethod || 'GET';
    const q=event.queryStringParameters||{};
    let body={}; try{body=event.body?JSON.parse(event.body):{};}catch{}

    if(method==='GET' && q.action==='health'){
      await sbFetch('/rest/v1/members?select=id&limit=1');
      return json(200,{ok:true,database:true});
    }

    if(method==='POST' && q.action==='login'){
      const input=String(body.password||'');
      const actual=String(ADMIN_PASSWORD()||'');
      const a=Buffer.from(input), b=Buffer.from(actual);
      const ok=a.length===b.length && crypto.timingSafeEqual(a,b);
      if(!ok) return json(401,{error:'INVALID_PASSWORD',message:'관리자 비밀번호가 일치하지 않습니다.'});
      const exp=Date.now()+4*60*60*1000;
      await addLog('관리자 로그인');
      return json(200,{ok:true,token:signToken(exp),expiresAt:exp});
    }

    if(method==='GET' && q.resource==='members'){
      const {data}=await sbFetch('/rest/v1/members?select=*&order=sort_order.asc,id.asc');
      return json(200,{items:(data||[]).map(mapMemberFromDb)});
    }
    if(method==='PUT' && q.resource==='members'){
      requireAdmin(event);
      const items=Array.isArray(body.items)?body.items:[];
      await replaceTable('members',items.map(mapMemberToDb));
      await addLog('인명부 전체 저장','members',`${items.length}명`);
      return json(200,{ok:true,count:items.length});
    }

    if(method==='GET' && q.resource==='work'){
      const {data}=await sbFetch('/rest/v1/work_contacts?select=*&order=sort_order.asc,id.asc');
      return json(200,{items:(data||[]).map(mapWorkFromDb)});
    }
    if(method==='PUT' && q.resource==='work'){
      requireAdmin(event);
      const items=Array.isArray(body.items)?body.items:[];
      await replaceTable('work_contacts',items.map(mapWorkToDb));
      await addLog('업무연락처 전체 저장','work_contacts',`${items.length}건`);
      return json(200,{ok:true,count:items.length});
    }

    if(method==='GET' && q.resource==='documents'){
      const {data}=await sbFetch('/rest/v1/documents?select=*&order=sort_order.asc,created_at.desc');
      return json(200,{items:(data||[]).map(mapDocFromDb)});
    }
    if(method==='POST' && q.action==='pdf-init'){
      requireAdmin(event);
      const fileName=String(body.fileName||'document.pdf');
      if(!fileName.toLowerCase().endsWith('.pdf')) return json(400,{error:'PDF_ONLY',message:'PDF 파일만 등록할 수 있습니다.'});
      const path=safePathName(fileName);
      return json(200,{ok:true,...await createSignedUpload(path)});
    }
    if(method==='POST' && q.action==='pdf-complete'){
      requireAdmin(event);
      const row={title:String(body.title||'').trim(),category:String(body.category||'기타').trim()||'기타',reference_date:body.baseDate||null,description:String(body.description||''),file_name:String(body.fileName||''),file_path:String(body.filePath||''),sort_order:0};
      if(!row.title||!row.file_path) return json(400,{error:'MISSING_FIELDS',message:'PDF 제목 또는 파일 경로가 없습니다.'});
      const {data}=await sbFetch('/rest/v1/documents',{method:'POST',headers:{'content-type':'application/json','Prefer':'return=representation'},body:JSON.stringify(row)});
      await addLog('PDF 등록','documents',row.title);
      return json(200,{ok:true,item:mapDocFromDb(Array.isArray(data)?data[0]:data)});
    }
    if(method==='PATCH' && q.resource==='document'){
      requireAdmin(event);
      const id=Number(q.id); if(!id) return json(400,{error:'BAD_ID'});
      const patch={title:String(body.title||'').trim(),category:String(body.category||'기타').trim()||'기타',reference_date:body.baseDate||null,description:String(body.description||'')};
      await sbFetch(`/rest/v1/documents?id=eq.${id}`,{method:'PATCH',headers:{'content-type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(patch)});
      await addLog('PDF 정보 수정','documents',patch.title);
      return json(200,{ok:true});
    }
    if(method==='DELETE' && q.resource==='document'){
      requireAdmin(event);
      const id=Number(q.id); if(!id) return json(400,{error:'BAD_ID'});
      const {data}=await sbFetch(`/rest/v1/documents?id=eq.${id}&select=file_path,title`);
      const d=Array.isArray(data)?data[0]:null;
      if(d?.file_path){ try{await deleteStorage(d.file_path);}catch{} }
      await sbFetch(`/rest/v1/documents?id=eq.${id}`,{method:'DELETE',headers:{'Prefer':'return=minimal'}});
      await addLog('PDF 삭제','documents',d?.title||String(id));
      return json(200,{ok:true});
    }
    if(method==='GET' && q.action==='pdf-view'){
      const id=Number(q.id); if(!id) return json(400,{error:'BAD_ID'});
      const {data}=await sbFetch(`/rest/v1/documents?id=eq.${id}&select=file_path,title`);
      const d=Array.isArray(data)?data[0]:null;
      if(!d?.file_path) return json(404,{error:'NOT_FOUND'});
      return json(200,{ok:true,url:await createSignedView(d.file_path,3600),title:d.title||''});
    }
    if(method==='GET' && q.resource==='logs'){
      requireAdmin(event);
      const {data}=await sbFetch('/rest/v1/admin_logs?select=*&order=created_at.desc&limit=100');
      return json(200,{items:data||[]});
    }

    return json(404,{error:'NOT_FOUND',message:'지원하지 않는 요청입니다.'});
  } catch (e) {
    const status=e.status||500;
    return json(status,{error:'APP_API_ERROR',message:String(e.message||e)});
  }
};
