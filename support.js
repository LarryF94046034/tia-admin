// Imported by app.js through an injected context; private data stays in memory.
export async function renderSupport(ctx){
  const {$,api,element,status,stamp,fail,kind,page,active}=ctx;
  $('list-title').textContent=({support:'客服案件',lookup:'玩家查詢',health:'系統健康'})[kind];
  $('records').replaceChildren();$('updated').textContent='更新於 '+new Date().toLocaleTimeString('zh-TW');
  $('previous').disabled=kind!=='support'||page===0;$('next').disabled=true;$('page-number').textContent=String(page+1);
  const pretty=value=>element('pre',JSON.stringify(value,null,2),'support-data');
  const detail=(...children)=>{if(active())$('detail').replaceChildren(...children);};
  function input(placeholder,max=100){const field=element('input');field.placeholder=placeholder;field.maxLength=max;return field;}
  if(kind==='health'){
    const result=await api('operations_health',{});
    if(!active())return;
    $('records').append(element('h2','告警與寄信'),element('p','Email：'+({not_configured:'尚未設定 SMTP',configured:'已設定',sent:'最近告警已寄出',delivery_failed:'寄送失敗，請核對私人設定'})[result.email.state]));
    for(const alert of result.alerts)$('records').append(element('p',`${alert.active?'⚠ 異常':'✓ 已恢復'} ${alert.code}：${alert.detail}`));
    if(!result.alerts.length)$('records').append(element('p','目前無告警紀錄。'));
    detail(element('h2','伺服器健康'),element('p','更新時間：'+stamp(result.sample_at)),pretty(result.sample),element('p','Google Play 課金與 Android Vitals 尚未接入。此頁不代表已通過封測容量評估。'),element('h3','隔離還原及容量基準'),pretty(result.reports),element('h3','最近 60 分鐘請求統計'),pretty(result.metrics));
    return;
  }
  if(kind==='lookup'){
    const player=input('PlayFab 玩家 ID',32),search=element('button','查詢玩家');
    $('records').append(element('p','依玩家 ID 查詢；每次查閱均有稽核紀錄。'),player,search);
    search.onclick=async()=>{if(!active())return;search.disabled=true;try{const result=await api('support_lookup',{player:player.value.trim().toUpperCase()});
      if(!active())return;
      status('已讀取玩家資料；Google Play 課金尚未接入。');
      detail(element('h2','玩家 '+result.player),element('p',result.billing.status+'；手機紀錄不能證明已付款。'),pretty(result));
      const subject=input('客服案件標題',40),body=element('textarea');body.maxLength=300;body.placeholder='問題與查核依據（不填密碼或付款權杖）';
      const create=element('button','建立客服案件');
      create.onclick=async()=>{if(!subject.value.trim()||!body.value.trim())return;create.disabled=true;try{const row=await api('support_create',{player:result.player,subject:subject.value.trim(),body:body.value.trim(),request_id:crypto.randomUUID()});status('已建立 '+row.case_id);}catch(error){fail(error);}finally{if(active())create.disabled=false;}};
      if(active())$('detail').append(subject,body,create);
    }catch(error){fail(error);}finally{if(active())search.disabled=false;}};
    const file=element('input');file.type='file';file.accept='.json,application/json';
    const note=element('p','選取玩家提供的支援檔，僅在本頁顯示摘要與 SHA-256，不會上傳或更動玩家資產。');
    file.onchange=async()=>{try{
      const selected=file.files[0];if(!selected)return;if(selected.size>2097152)throw Error('SUPPORT_FILE_TOO_LARGE');
      const bytes=await selected.arrayBuffer();if(!active())return;
      const value=JSON.parse(new TextDecoder().decode(bytes));
      if(value.type!=='tia-support'||value.format!==1||!Array.isArray(value.events)||value.events.length>512)throw Error('SUPPORT_FILE_INVALID');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(!active())return;
      detail(element('h2','本機檔案摘要（未驗證）'),element('p','玩家 ID：'+String(value.player??'').slice(0,32)),element('p','SHA-256：'+hash),element('p','紀錄數：'+value.events.length),element('p','請查核伺服器收據與訂單；檔案可遭修改，不能作為補發或付款的唯一依據。'));
    }catch{if(active())status('無法讀取支援檔，請確認格式及 2 MB 上限。');}finally{file.value='';}};
    $('records').append(element('h3','查閱玩家提供的紀錄'),note,file);return;
  }
  const result=await api('support_list',{page});if(!active())return;$('next').disabled=result.rows.length<50;
  if(!result.rows.length)$('records').append(element('p','目前沒有客服案件；可從玩家查詢建立。'));
  for(const row of result.rows){
    const button=element('button',undefined,'record');button.append(element('strong',row.subject),element('span',row.id+' · '+row.player),element('span',(row.state==='open'?'處理中':'已結案')+' '+stamp(row.created)));$('records').append(button);
    button.onclick=async()=>{try{
      const result=await api('support_detail',{case_id:row.id});const c=result.case;
      if(!active())return;
      detail(element('h2',c.subject),element('p',c.id+' · '+c.player),element('p',c.body),element('p',c.resolution));
      if(result.grant){
        if(active())$('detail').append(element('h3','已建立補發信件'),pretty(result.grant));
        if(c.state==='open'){
          const reason=input('結案理由',240),close=element('button','確認結案');
          close.onclick=async()=>{if(!active()||!reason.value.trim())return;close.disabled=true;try{await api('support_resolve',{case_id:c.id,reason:reason.value.trim(),request_id:crypto.randomUUID()});status('已結案。');}catch(error){fail(error);}finally{if(active())close.disabled=false;}};
          if(active())$('detail').append(reason,close);
        }
        return;
      }
      if(c.state!=='open')return;
      const reason=input('處理理由／玩家可見的補發說明',240),confirmPlayer=input('補發時請輸入完整玩家 ID',32);
      const gold=input('金幣數量'),ruby=input('紅寶石數量'),diamond=input('鑽石數量');for(const field of [gold,ruby,diamond]){field.type='number';field.min='0';field.max='1000000';field.value='0';}
      const grant=element('button','確認建立指定玩家補發信件（限擁有者）'),close=element('button','結案（不補發）');
      let requestId=crypto.randomUUID();
      grant.onclick=async()=>{if(!reason.value.trim()||confirmPlayer.value!==c.player){status('請填寫理由及正確玩家 ID。');return;}
        if(!window.confirm(`補發給 ${c.player}：金幣 ${gold.value}、紅寶石 ${ruby.value}、鑽石 ${diamond.value}。確認建立信件？`))return;
        grant.disabled=true;
        try{const receipt=await api('support_grant',{case_id:c.id,confirm_player:confirmPlayer.value,reason:reason.value.trim(),items:{},gold:Number(gold.value),ruby:Number(ruby.value),diamond:Number(diamond.value),request_id:requestId});
          if(active())$('detail').append(pretty(receipt));status('已建立補發信件，待玩家領取。');
        }catch(error){fail(error);if(active())grant.disabled=false;}};
      close.onclick=async()=>{if(!reason.value.trim()){status('請填寫結案理由。');return;}close.disabled=true;try{await api('support_resolve',{case_id:c.id,reason:reason.value.trim(),request_id:crypto.randomUUID()});status('已結案。');}catch(error){fail(error);}finally{if(active())close.disabled=false;}};
      if(active())$('detail').append(element('h3','補發與結案'),element('p','補發經既有信箱領取；每案最多一筆。系統不提供未接入 Google Play 的付款退款。'),reason,confirmPlayer,element('label','金幣'),gold,element('label','紅寶石'),ruby,element('label','鑽石'),diamond,grant,close);
    }catch(error){fail(error);}};
  }
}
