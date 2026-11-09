// All tokens and case data remain in page memory. Never localStorage, cookies or a public JSON export.
const $=id=>document.getElementById(id);
const labels={cases:'檢舉案件',appeals:'申訴管理',audit:'操作紀錄',open:'待審查',processing:'處理中',closed:'已結案',harassment:'騷擾／辱罵',sexual:'色情／兒少安全',hate:'仇恨／威脅',fraud:'詐騙／廣告',spam:'洗頻',privacy:'洩漏個資',other:'其他',message:'好友私訊',player:'玩家暱稱',guild:'公會內容',guild_mail:'公會信件',warn:'警告',mute:'禁言',ban:'停權',remove_content:'移除內容',dismiss:'檢舉不成立',active:'生效中',revoked:'已撤銷',expired:'已到期',provider_pending:'待確認外部處理結果'};
let config,msalApp,account,kind='cases',page=0,selected='',busy=false,current,refreshTimer;
const text=(value)=>String(value??'');
const stamp=value=>value?new Date(Number(value)*1000).toLocaleString('zh-TW'):'—';
const element=(tag,value,className)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=text(value);if(className)e.className=className;return e;};
const status=message=>$('status').textContent=message;
const errors={ADMIN_MFA_REQUIRED:'尚未取得多重要素驗證證明。請登出後重新進行 Microsoft MFA 登入；未驗證前不會顯示玩家資料。',ADMIN_FORBIDDEN:'此帳號沒有管理權限。',ADMIN_REAUTH_REQUIRED:'管理工作階段已到期，請重新登入。',ADMIN_AUTH_REQUIRED:'管理員驗證失敗，請重新登入。',ADMIN_NOT_CONFIGURED:'伺服器的管理員登入設定尚未完成。',COMMUNITY_CONTENT_CHANGED:'原內容已被更改，未移除新內容。請重新審查。',COMMUNITY_PROVIDER_REVIEW:'外部處理結果尚未確認，請核對 PlayFab 紀錄，勿重複建立處分。',COMMUNITY_CASE_CLOSED:'案件已結案或正在處理，請重新整理。',COMMUNITY_CONFIRM_REQUIRED:'確認玩家 ID 不符，未執行處分。'};

async function token(interactive=false){
  const request={scopes:[`api://${config.clientId}/Admin.Access`],account};
  try{return (await msalApp.acquireTokenSilent(request)).accessToken;}
  catch(error){if(!interactive)throw new Error('ADMIN_REAUTH_REQUIRED');return (await msalApp.acquireTokenPopup({...request,prompt:'login'})).accessToken;}
}
async function api(action,args){
  const accessToken=await token();
  const response=await fetch(config.api,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${accessToken}`},body:JSON.stringify({action,arguments:args}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(result.error||'ADMIN_UNAVAILABLE');
  return result.result;
}
function fail(error){status(errors[error.message]||'操作未確認，請重新整理後再試。');if(['ADMIN_AUTH_REQUIRED','ADMIN_REAUTH_REQUIRED','ADMIN_FORBIDDEN','ADMIN_MFA_REQUIRED'].includes(error.message))clearWorkspace();}
function clearWorkspace(){clearInterval(refreshTimer);$('workspace').hidden=true;$('login').hidden=false;$('signout').hidden=true;$('records').replaceChildren();$('detail').replaceChildren();current=null;selected='';account=null;}
async function refresh(){
  if(busy||!account)return;busy=true;$('refresh').disabled=true;
  try{
    const result=await api('list',{kind,page});
    $('case-count').textContent=result.counts.cases;$('appeal-count').textContent=result.counts.appeals;
    $('list-title').textContent=labels[kind];$('updated').textContent='更新於 '+new Date().toLocaleTimeString('zh-TW');$('page-number').textContent=String(page+1);$('previous').disabled=page===0;$('next').disabled=result.rows.length<50;
    $('records').replaceChildren();
    if(!result.rows.length)$('records').append(element('p','目前沒有紀錄。','muted'));
    for(const row of result.rows){
      const button=element('button',undefined,'record'+(selected===row.id?' selected':''));
      button.append(element('strong',row.id),element('span',kind==='cases'?`${labels[row.source]||row.source} · ${labels[row.reason]||row.reason}`:kind==='audit'?`${row.actor} · ${row.operation}`:row.action_id),element('span',`${labels[row.state]||row.state||''}　${stamp(row.created||row.at)}`));
      button.onclick=()=>{if(kind==='cases')openCase(row.id);else if(kind==='appeals')openAppeal(row);else showAudit(row);};$('records').append(button);
    }
  }catch(error){fail(error);}finally{busy=false;$('refresh').disabled=false;}
}
function addField(list,label,value){list.append(element('dt',label),element('dd',value));}
async function openCase(id){
  if(busy)return;busy=true;
  try{const result=await api('detail',{case_id:id});current=result;selected=id;renderCase(result);}catch(error){fail(error);}finally{busy=false;}
}
function renderEvidence(raw){
  const section=element('section',undefined,'evidence');
  let data;try{data=JSON.parse(raw);}catch{data={};}
  if(data.context){for(const message of data.context){const entry=element('p');entry.append(element('strong',`${message.sender}　${stamp(message.created)}`),element('br'),document.createTextNode(message.body));section.append(entry);}}
  else if(data.profile){try{section.textContent=JSON.parse(data.profile).name||'未設定名稱';}catch{section.textContent='內容格式無法顯示';}}
  else if(Object.keys(data).length){for(const key of ['name','notice','description','title','body'])if(data[key])section.append(element('p',`${({name:'公會名稱',notice:'公告',description:'介紹',title:'標題',body:'內容'})[key]}：${data[key]}`));}
  else section.textContent='內容已到保存期限，或沒有可顯示的證據。';
  return section;
}
function renderCase(result){
  const c=result.case;const detail=$('detail');detail.replaceChildren(element('h2','案件詳情'));
  const info=element('dl');addField(info,'案件編號',c.id);addField(info,'被檢舉者',c.target);addField(info,'檢舉原因',labels[c.reason]||c.reason);addField(info,'內容類型',labels[c.source]||c.source);addField(info,'收到時間',stamp(c.created));addField(info,'目前狀態',labels[c.state]||c.state);detail.append(info);
  if(c.note)detail.append(element('p','檢舉說明：'+c.note));detail.append(element('h2','伺服器保存證據'),renderEvidence(c.evidence));
  if(c.state==='open'){
    const actions=element('div',undefined,'actions');
    for(const action of ['dismiss','warn','mute','remove_content','ban']){const b=element('button',labels[action],['ban','remove_content'].includes(action)?'danger':'');b.onclick=()=>decide(action,c);actions.append(b);}detail.append(actions);
  }
  for(const action of result.actions)detail.append(element('p',`${labels[action.kind]||action.kind} · ${labels[action.state]||action.state}\n${action.reason}\n${action.id}`));
  for(const appeal of result.appeals)renderAppeal(detail,appeal);
}
function renderAppeal(parent,appeal){
  const section=element('section',undefined,'appeal');section.append(element('h2','申訴 '+appeal.id),element('p',appeal.body),element('p',appeal.decision||'等待審查'));
  if(appeal.state==='open')for(const [decision,label] of [['uphold','維持處分'],['overturn','撤銷處分']]){const b=element('button',label);b.onclick=()=>reviewAppeal(appeal,decision);section.append(b);}parent.append(section);
}
async function openAppeal(row){
  // The list carries no private text. Evidence remains scoped to an explicitly
  // selected case; the API resolves appeal -> case without arbitrary chat reads.
  status('請從對應檢舉案件查看此申訴：'+row.id);
  try{const result=await api('appeal_detail',{appeal_id:row.id});current=result;renderCase(result);}catch(error){fail(error);}
}
function showAudit(row){$('detail').replaceChildren(element('h2','操作紀錄'),element('p',`${row.actor}\n${row.operation}\n${row.reference}\n${stamp(row.at)}`),element('p',row.detail));}
function confirmation(title,target,withDuration,danger){
  const dialog=$('confirm');$('confirm-text').textContent=title;$('decision-reason').value='';$('confirm-target').value='';$('duration-label').hidden=!withDuration;$('target-label').hidden=!danger;
  dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>{if(dialog.returnValue!=='submit'){resolve(null);return;}const reason=$('decision-reason').value.trim();if(!reason){status('未填寫處理理由，未執行操作。');resolve(null);return;}if(danger&&$('confirm-target').value!==target){status('確認對象不符，未執行操作。');resolve(null);return;}resolve({reason,hours:withDuration?Number($('duration').value):0,confirm_target:danger?target:''});},{once:true}));
}
async function decide(action,c){
  if(busy)return;const answer=await confirmation(`對玩家 ${c.target} 執行「${labels[action]}」。${action==='ban'?'此操作會限制登入遊戲。':''}`,c.target,['mute','ban'].includes(action),['ban','remove_content'].includes(action));if(!answer)return;
  busy=true;const request_id=crypto.randomUUID();
  try{await api('decide',{...answer,request_id,case_id:c.id,kind:action});status('處理已完成。');}catch(error){fail(error);}finally{busy=false;}
  if(account){await openCase(c.id);await refresh();}
}
async function reviewAppeal(appeal,decision){
  if(busy)return;const answer=await confirmation(decision==='overturn'?'撤銷這筆申訴對應的處分。':'維持原處分，請說明理由。','',false,false);if(!answer)return;
  busy=true;try{await api('appeal',{appeal_id:appeal.id,decision,reason:answer.reason,request_id:crypto.randomUUID()});status('申訴已處理。');}catch(error){fail(error);}finally{busy=false;}
  if(account&&current)await openCase(current.case.id);
}
$('signin').onclick=async()=>{
  $('signin').disabled=true;
  try{const result=await msalApp.loginPopup({scopes:[`api://${config.clientId}/Admin.Access`],prompt:'select_account'});account=result.account;await token(true);$('identity').textContent=account.username;$('login').hidden=true;$('workspace').hidden=false;$('signout').hidden=false;status('');await refresh();refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},30000);}catch(error){fail(error);}finally{$('signin').disabled=false;}
};
$('signout').onclick=()=>{const previous=account;clearWorkspace();$('identity').textContent='管理員登入';msalApp.clearCache({account:previous});status('已登出，頁面中的案件資料與權杖已清除。');};
document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{kind=button.dataset.page;page=0;selected='';document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b===button));$('detail').replaceChildren(element('p','請選擇一筆紀錄。','muted'));refresh();});
$('refresh').onclick=refresh;$('previous').onclick=()=>{page=Math.max(0,page-1);refresh();};$('next').onclick=()=>{page++;refresh();};
try{
  config=await (await fetch('config.json',{cache:'no-store'})).json();
  if(!/^[a-f0-9-]{36}$/i.test(config.clientId)){$('signin').disabled=true;$('setup').textContent='管理員登入設定準備中，尚未開放讀取玩家資料。';}
  else{msalApp=new msal.PublicClientApplication({auth:{clientId:config.clientId,authority:`https://login.microsoftonline.com/${config.tenant}`,redirectUri:new URL('auth.html',location.href).href},cache:{cacheLocation:'memoryStorage'},system:{allowPlatformBroker:false}});await msalApp.initialize();}
}catch{status('登入設定載入失敗，請稍後重試。');$('signin').disabled=true;}
