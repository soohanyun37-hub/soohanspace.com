(function(){
  'use strict';
  var INTRO_KEY='soohan_intro_seen_at';
  var INTRO_TTL=24*60*60*1000;
  var PHOTO_SEEN='soohan_photo_sheet_seen';
  var RECENT_KEY='soohan_recent_pages_v1';
  var KAKAO_HOST='open.kakao.com';

  function safeGet(store,key){try{return store.getItem(key)}catch(e){return null}}
  function safeSet(store,key,val){try{store.setItem(key,val)}catch(e){}}
  function track(name,params){
    try{
      if(typeof window.gtag==='function'){
        params=params||{};params.transport_type='beacon';
        window.gtag('event',name,params);
      }
    }catch(e){}
  }
  function pagePath(){return location.pathname||'/'}
  function pageTitle(){
    var h1=document.querySelector('h1');
    var s=(h1&&h1.textContent?h1.textContent:document.title||'').replace(/\s+/g,' ').trim();
    return s.replace(/\s*[|｜]\s*수한공간.*$/,'').slice(0,80)||'수한공간';
  }
  function brandInfo(){
    var p=pagePath().toLowerCase();
    if(/^\/(tile|questions\/tile|area\/tile)(\/|$)/.test(p)) return {key:'tile',label:'타일'};
    if(/^\/(bath|questions\/bath|area\/bath)(\/|$)/.test(p)) return {key:'bath',label:'욕실'};
    if(/^\/(repair|questions\/repair|area\/repair)(\/|$)/.test(p)) return {key:'repair',label:'집수리'};
    if(p.indexOf('/winter-tile-')===0||p.indexOf('/seasonal/winter-tile-')===0) return {key:'tile',label:'타일'};
    if(p.indexOf('/seasonal/spring-bath-')===0||p.indexOf('/seasonal/rainy-season-waterproofing')===0) return {key:'bath',label:'욕실'};
    var map={'010-4646-3145':'tile','010-8672-3145':'bath','010-4643-3145':'repair'};
    var counts={tile:0,bath:0,repair:0};
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){
      var n=(a.getAttribute('href')||'').replace('tel:','').replace(/\s/g,'');
      if(map[n]) counts[map[n]]++;
    });
    var arr=Object.keys(counts).map(function(k){return [k,counts[k]]}).sort(function(a,b){return b[1]-a[1]});
    if(arr[0][1]>=3 && arr[0][1]>=Math.max(2,arr[1][1]*2)){
      return {key:arr[0][0],label:arr[0][0]==='tile'?'타일':arr[0][0]==='bath'?'욕실':'집수리'};
    }
    return {key:'general',label:''};
  }

  /* 1) 인트로: 0.2s fade-in → 0.7s hold → 0.28s fade-out = 약 1.18s */
  function initIntro(){
    var html=document.documentElement;
    var overlay=document.getElementById('soohan-intro');
    if(!overlay||!html.classList.contains('soohan-intro-play')) return;
    safeSet(localStorage,INTRO_KEY,String(Date.now()));
    track('intro_view',{page_path:pagePath()});
    var dismissed=false,autoTimer=null,removeTimer=null;
    function finish(fast,reason){
      if(dismissed)return;dismissed=true;
      if(autoTimer)clearTimeout(autoTimer);
      if(fast)overlay.classList.add('is-fast');
      overlay.classList.add('is-hiding');
      overlay.classList.remove('is-visible');
      track('intro_dismiss',{page_path:pagePath(),dismiss_type:reason||'auto'});
      removeTimer=setTimeout(function(){
        overlay.style.display='none';
        html.classList.remove('soohan-intro-play');
        html.classList.add('soohan-intro-skip');
        unbind();
      },fast?130:300);
    }
    function userDismiss(){finish(true,'interaction')}
    function bind(){
      overlay.addEventListener('pointerdown',userDismiss,{passive:true});
      window.addEventListener('keydown',userDismiss,{passive:true});
      window.addEventListener('wheel',userDismiss,{passive:true});
      window.addEventListener('touchmove',userDismiss,{passive:true});
    }
    function unbind(){
      overlay.removeEventListener('pointerdown',userDismiss);
      window.removeEventListener('keydown',userDismiss);
      window.removeEventListener('wheel',userDismiss);
      window.removeEventListener('touchmove',userDismiss);
    }
    bind();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        overlay.classList.add('is-visible');
        /* 0.20초 인 + 0.70초 완전 표시 후 아웃 시작 */
        autoTimer=setTimeout(function(){finish(false,'auto')},900);
      });
    });
  }

  /* 2) 페이지 성격에 맞춰 모바일 사진 CTA만 구분 */
  function updateMobileCTA(){
    var b=brandInfo();if(b.key==='general')return;
    document.querySelectorAll('.mobile-cta a.k').forEach(function(a){
      var svg=a.querySelector('svg');
      Array.prototype.slice.call(a.childNodes).forEach(function(n){if(n!==svg)a.removeChild(n)});
      if(svg)a.appendChild(svg);
      a.appendChild(document.createTextNode(' '+b.label+' 사진상담'));
      a.setAttribute('aria-label',b.label+' 카카오톡 사진 상담하기');
    });
    document.querySelectorAll('.floating .fb.k span').forEach(function(s){s.textContent=b.label+' 사진상담'});
  }

  /* 3) 사진 상담 전 3장 퀵패널 */
  function createPhotoSheet(){
    var b=brandInfo();
    var wrap=document.createElement('div');
    wrap.className='soohan-sheet-backdrop';wrap.id='soohanPhotoSheet';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML='\
      <section class="soohan-photo-sheet" role="dialog" aria-modal="true" aria-labelledby="soohanSheetTitle">\
        <div class="soohan-sheet-handle" aria-hidden="true"></div>\
        <button type="button" class="soohan-sheet-close" aria-label="사진 상담 안내 닫기">×</button>\
        <p class="soohan-sheet-eyebrow">사진 상담</p>\
        <h2 class="soohan-sheet-title" id="soohanSheetTitle">'+(b.label?b.label+' ':'')+'상담 전에 사진 3장만 준비해주세요</h2>\
        <ol class="soohan-photo-list">\
          <li><b>01</b>전체 공간 사진</li>\
          <li><b>02</b>문제 부위 가까운 사진</li>\
          <li><b>03</b>옆에서 본 상태 사진</li>\
        </ol>\
        <p class="soohan-sheet-note">지역 · 문제 · 원하는 작업을 함께 남겨주시면 더 빠르게 확인할 수 있습니다.</p>\
        <div class="soohan-sheet-actions">\
          <a class="soohan-sheet-primary" data-soohan-direct-kakao="1" href="https://open.kakao.com/me/soohanyun">사진 준비됐어요 · 카카오톡 상담</a>\
          <a class="soohan-sheet-secondary" href="/checklist/">사진 3장 찍는 방법 자세히 보기</a>\
        </div>\
      </section>';
    document.body.appendChild(wrap);
    return wrap;
  }
  function initPhotoSheet(){
    var sheet=null,lastFocus=null;
    function close(){
      if(!sheet)return;sheet.classList.remove('is-open');sheet.setAttribute('aria-hidden','true');document.body.classList.remove('soohan-sheet-open');
      if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}
    }
    function open(source){
      if(!sheet)sheet=createPhotoSheet();
      lastFocus=document.activeElement;
      safeSet(sessionStorage,PHOTO_SEEN,'1');
      sheet.classList.add('is-open');sheet.setAttribute('aria-hidden','false');document.body.classList.add('soohan-sheet-open');
      track('photo_quick_panel_open',{page_path:pagePath(),brand:brandInfo().key,source:source||'kakao'});
      setTimeout(function(){var c=sheet.querySelector('.soohan-sheet-close');if(c)c.focus()},20);
    }
    document.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a[href]');
      if(!a)return;
      var href=a.getAttribute('href')||'';
      var direct=a.getAttribute('data-soohan-direct-kakao')==='1';
      if(href.indexOf(KAKAO_HOST)!==-1){
        if(direct){
          track('kakao_consult_click',{page_path:pagePath(),brand:brandInfo().key,source:'photo_sheet'});
          return;
        }
        if(safeGet(sessionStorage,PHOTO_SEEN)!=='1'){
          e.preventDefault();
          track('kakao_consult_intent',{page_path:pagePath(),brand:brandInfo().key,source:(a.className||'').toString().slice(0,80)});
          open('kakao_link');
          return;
        }
        track('kakao_consult_click',{page_path:pagePath(),brand:brandInfo().key,source:'direct_repeat'});
      }else if(href.indexOf('/checklist/')!==-1){
        track('photo_checklist_click',{page_path:pagePath()});
      }else if(href.indexOf('/cases/')!==-1){
        track('case_click',{page_path:pagePath(),destination:href});
      }else if(href.indexOf('tel:')===0){
        track('phone_click',{page_path:pagePath(),brand:brandInfo().key,phone:href.replace('tel:','')});
      }
    },true);
    document.addEventListener('click',function(e){
      if(!sheet)return;
      if(e.target===sheet||e.target.closest('.soohan-sheet-close'))close();
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sheet&&sheet.classList.contains('is-open'))close()});
  }

  /* 4) 최근 본 상세페이지 3개 */
  function isRecentEligible(path){
    var exclude=['/','/tile/','/bath/','/repair/','/cases/','/checklist/','/faq/','/contact/','/questions/','/area/','/seasonal/','/sitemap/','/estimate-guide/','/process/','/monthly-check/'];
    return exclude.indexOf(path)===-1;
  }
  function readRecent(){
    try{var x=JSON.parse(safeGet(localStorage,RECENT_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return []}
  }
  function writeRecent(x){safeSet(localStorage,RECENT_KEY,JSON.stringify(x.slice(0,8)))}
  function initRecent(){
    var path=pagePath();
    var history=readRecent().filter(function(x){return x&&x.path&&x.title&&x.path!==path});
    if(isRecentEligible(path)&&history.length){
      var items=history.slice(0,3);
      var sec=document.createElement('section');sec.className='soohan-recent';sec.setAttribute('aria-label','최근 확인한 페이지');
      sec.innerHTML='<div class="soohan-recent-inner"><p class="soohan-recent-label">RECENT</p><h2 class="soohan-recent-title">최근 확인한 내용</h2><div class="soohan-recent-list">'+items.map(function(x){
        var safeTitle=String(x.title).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
        var safePath=String(x.path).replace(/"/g,'&quot;');
        return '<a class="soohan-recent-link" data-soohan-recent="1" href="'+safePath+'">'+safeTitle+'<span>'+safePath+'</span></a>';
      }).join('')+'</div></div>';
      var footer=document.querySelector('footer');if(footer&&footer.parentNode)footer.parentNode.insertBefore(sec,footer);
    }
    if(isRecentEligible(path)){
      history.unshift({path:path,title:pageTitle(),ts:Date.now()});
      var seen={};history=history.filter(function(x){if(seen[x.path])return false;seen[x.path]=1;return true});
      writeRecent(history);
    }
    document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-soohan-recent="1"]');if(a)track('recent_page_click',{page_path:path,destination:a.getAttribute('href')||''})});
  }

  function init(){
    initIntro();
    updateMobileCTA();
    initPhotoSheet();
    initRecent();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
