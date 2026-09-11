/* 제11회 직무채용박람회 소통 — 기업별 사전질문 페이지 공통 스크립트
   페이지에서 <body data-co="21"> 로 기업 번호만 지정하면 됨 */

const SHEET_ID = '1yhhG0z90ueUO9cyAHlc4IoCVzCMXvjo8UskltCsXP4c';
const GID = '984055483';            // 「신청+사전질문」 시트
const CSV = () => 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
                  '/gviz/tq?tqx=out:csv&gid=' + GID + '&_=' + Date.now();

/* ---------- CSV 파서 ---------- */
function parseCSV(t){
  const rows=[]; let row=[], f='', q=false;
  t = t.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(f); f=''; }
    else if(c==='\n'){ row.push(f); rows.push(row); row=[]; f=''; }
    else f+=c;
  }
  if(f.length||row.length){ row.push(f); rows.push(row); }
  return rows;
}

/* 설문 응답에 섞여 들어온 HTML 엔티티(&#039; 등) 복원 */
const TXTAREA = document.createElement('textarea');
function decode(s){
  if(!s || s.indexOf('&')<0) return s;
  TXTAREA.innerHTML = s; return TXTAREA.value;
}

/* 기업명 문자열 → {num, name, job}
   예) "(A)현직자 직무멘토링_01_이랜드팜앤푸드_구매" → 01 / 이랜드팜앤푸드 / 구매
       "K-친화기업 채용컨설팅_C1_㈜캐럿글로벌"      → C1 / ㈜캐럿글로벌 / (없음) */
function splitCo(s){
  const p = String(s||'').split('_');
  return { num:(p[1]||'').trim(), name:(p[2]||'').trim(), job:(p[3]||'').trim(), full:s };
}

/* ---------- 한국어 간이 키워드 추출 ---------- */
const STOP = new Set(('것 수 등 및 관련 대해 대한 무엇 무엇인지 어떤 어떻게 어떠한 있는지 있을 있는 없는 가장 정말 조금 매우 제가 저는 저희 그리고 하지만 그런 이런 저런 때문 통해 위해 경우 정도 부분 생각 궁금 궁금합니다 궁금해요 알고 싶습니다 합니다 입니다 있습니다 해서 하는 하고 되는 되고 드립니다 부탁 질문 답변 여쭙 여쭤 관해 여부 자체 이상 이하 다른 많이 많은 어느 무슨 실제 실제로 특히 각각 또한 혹은 또는 만약 정확히 가지 여러 다양한 해당 관심 사항 내용 이야기 말씀 였습니다 이라고 라고 인지 인가요 나요 까요 니다 네요 어요 아요 라면 으로서 로서 하나 있어 없어 좋을 좋은 좋겠습니다 어렵 힘든 대하여 대해서 있는데 싶은 싶어 관하여 주로 것이 것을 것은 필요한 현재 향후 이후 이전 관련된 어떠 저희가 제일 조언을 있으면 되면 라면서 하려면 위한 경우가 위주로 통한 함께 모두 전반 전반적으로 보통 보다는 참고').split(/\s+/));
const JOSA = /(으로서|으로써|에서의|에게서|이라는|라는|에서는|에게는|으로는|와의|과의|에서|에게|으로|처럼|보다|까지|부터|마다|이나|이란|라도|든지|이든|은|는|이|가|을|를|의|에|도|와|과|로|만|나|랑|께)$/;
const TAIL = /(합니다|했습니다|하는지|한지|해서|하며|하고|해요|이다|입니다|인가요|일까요|될까요|되나요|있나요|하나요|한가요|드립니다|드려요|싶어요|싶습니다|되는|되어|되었|하시는|하시|한다|싶음|인지|였는지|드릴|주시)$/;

function keywords(texts, limit=55){
  const cnt = new Map();
  for(const t of texts){
    if(!t) continue;
    for(let w of t.split(/[^0-9A-Za-z가-힣&+]+/)){
      if(!w || /^[0-9]+$/.test(w)) continue;
      if(/[가-힣]/.test(w)){
        w = w.replace(TAIL,'');
        if(w.length>2) w = w.replace(JOSA,'');
        if(w.length<2) continue;
      } else {
        if(w.length<2) continue;
        w = w.toUpperCase();
      }
      if(STOP.has(w)) continue;
      cnt.set(w,(cnt.get(w)||0)+1);
    }
  }
  let list = [...cnt.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0],'ko'));
  const multi = list.filter(e=>e[1]>=2);
  if(multi.length>=10) list = multi;          // 표본이 적으면 1회 키워드도 노출
  return list.slice(0,limit).map(([text,count])=>({text,count}));
}

/* ---------- 원형 워드클라우드 (나선 배치 + 충돌 검사) ---------- */
const PAL1=['#0b2a75','#1b4fd8','#3d74ff','#5b8bff','#2c3e8f','#7fa4ff'];
const PAL2=['#c2410c','#ff6b3d','#e8890c','#ff9466','#a3370a','#ffb07a'];

function drawCloud(el, words, pal){
  el.innerHTML='';
  const S = el.clientWidth || 340, R = S/2 - 6, cx=S/2, cy=S/2;
  if(!words.length){ el.innerHTML='<div class="empty" style="padding-top:42%">키워드 없음</div>'; return; }
  const max = words[0].count, min = words[words.length-1].count;
  const ctx = document.createElement('canvas').getContext('2d');
  const placed = [];
  words.forEach((w,i)=>{
    const ratio = max===min ? 0.6 : (w.count-min)/(max-min);
    const size = Math.max(11, Math.round(S*0.036 + Math.pow(ratio,0.62)*S*0.086));
    const font = '800 ' + size + 'px Pretendard,"Malgun Gothic",sans-serif';
    ctx.font = font;
    const tw = ctx.measureText(w.text).width, th = size*1.1;
    let x=cx, y=cy, ok=false;
    for(let t=0;t<3000;t++){
      const a = t*0.26, r = 2.4*a;
      x = cx + r*Math.cos(a); y = cy + r*Math.sin(a)*0.88;
      const l=x-tw/2, rr=x+tw/2, tp=y-th/2, bt=y+th/2;
      if(Math.hypot(l-cx,tp-cy)>R || Math.hypot(rr-cx,tp-cy)>R ||
         Math.hypot(l-cx,bt-cy)>R || Math.hypot(rr-cx,bt-cy)>R) continue;
      if(placed.some(p=> l < p.r+3 && rr > p.l-3 && tp < p.b+2 && bt > p.t-2)) continue;
      placed.push({l,r:rr,t:tp,b:bt}); ok=true; break;
    }
    if(!ok) return;
    const s = document.createElement('span');
    s.textContent = w.text;
    s.style.cssText = 'left:'+x+'px;top:'+y+'px;font:'+font+';color:'+pal[i%pal.length]+
                      ';opacity:'+(0.55+0.45*ratio);
    s.title = w.text + ' · ' + w.count + '회';
    el.appendChild(s);
  });
}

/* ---------- 시트 로드 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

async function fetchRows(){
  const res = await fetch(CSV());
  if(!res.ok) throw new Error('HTTP '+res.status);
  const rows = parseCSV(await res.text());
  const head = rows.shift().map(h=>h.replace(/\s/g,''));
  const ix = n => head.findIndex(h=>h.indexOf(n)>=0);
  const cCo=ix('기업명'), cName=ix('이름'), cGrade=ix('학년'),
        cDept=ix('학과'), cTime=ix('시간'), cQ1=ix('사전질문1'), cQ2=ix('사전질문2');
  return rows.filter(r=>r[cCo] && r[cCo].trim()).map(r=>({
    co:r[cCo].trim(), name:decode((r[cName]||'').trim()), grade:(r[cGrade]||'').trim(),
    dept:decode((r[cDept]||'').trim()), time:(r[cTime]||'').trim(),
    q1:decode((r[cQ1]||'').trim()), q2:decode((r[cQ2]||'').trim())
  }));
}

/* ---------- 기업 상세 페이지 ---------- */
async function initCompanyPage(){
  const CO = document.body.dataset.co;
  try{
    const all = await fetchRows();
    const rows = all.filter(r=>splitCo(r.co).num===CO)
      .sort((a,b)=> a.dept.localeCompare(b.dept,'ko') || a.name.localeCompare(b.name,'ko'));

    $('s1').textContent = rows.length;
    $('s2').textContent = rows.filter(r=>r.q1).length;
    $('s3').textContent = rows.filter(r=>r.q2).length;
    $('s4').textContent = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});

    $('tb').innerHTML = rows.length ? rows.map((r,i)=>
      '<tr><td class="idx">'+(i+1)+'</td>'+
      '<td class="dept">'+esc(r.dept)+'</td>'+
      '<td class="meta"><b>'+esc(r.name)+'</b></td>'+
      '<td class="meta">'+esc(r.grade)+'</td>'+
      '<td class="meta">'+esc(r.time)+'</td>'+
      '<td class="q1">'+(r.q1?esc(r.q1):'<span class="no">— 미작성 —</span>')+'</td>'+
      '<td class="q2">'+(r.q2?esc(r.q2):'<span class="no">— 미작성 —</span>')+'</td></tr>'
    ).join('') : '<tr><td colspan="7" class="empty">아직 등록된 신청 내역이 없습니다.</td></tr>';

    const k1 = keywords(rows.map(r=>r.q1)), k2 = keywords(rows.map(r=>r.q2));
    drawCloud($('c1'), k1, PAL1);
    drawCloud($('c2'), k2, PAL2);
    $('k1').innerHTML = k1.slice(0,14).map(k=>'<span class="chip">'+esc(k.text)+'<b>'+k.count+'</b></span>').join('');
    $('k2').innerHTML = k2.slice(0,14).map(k=>'<span class="chip">'+esc(k.text)+'<b>'+k.count+'</b></span>').join('');
    window.__rows = rows;
  }catch(e){
    $('tb').innerHTML = '<tr><td colspan="7" class="empty">데이터를 불러오지 못했습니다.<br>'+
      '구글 시트 공유 설정이 <b>“링크가 있는 모든 사용자 · 뷰어”</b>인지 확인해 주세요.<br>'+
      '<small>'+esc(e.message)+'</small></td></tr>';
  }
}

/* ---------- 허브(기업 목록) 페이지 ---------- */
async function initHubPage(){
  try{
    const all = await fetchRows();
    const map = new Map();
    all.forEach(r=>{
      const c = splitCo(r.co);
      if(!c.num) return;
      if(!map.has(c.num)) map.set(c.num, {...c, n:0});
      map.get(c.num).n++;
    });
    const list = [...map.values()].sort((a,b)=>a.num.localeCompare(b.num,'en',{numeric:true}));
    const A = list.filter(c=>!/^C/.test(c.num)), K = list.filter(c=>/^C/.test(c.num));
    const card = c => '<a class="card'+(/^C/.test(c.num)?' k':'')+'" href="'+c.num+'.html">'+
      '<span class="num">'+esc(/^C/.test(c.num)?c.num:'A'+c.num)+'</span>'+
      '<div class="nm">'+esc(c.name)+'</div>'+
      '<div class="jb">'+(c.job?esc(c.job)+' · ':'')+'신청 '+c.n+'명</div></a>';
    $('hub').innerHTML =
      '<div class="sect">(A) 현직자 직무멘토링 — '+A.length+'개 기업</div>'+
      '<div class="grid">'+A.map(card).join('')+'</div>'+
      (K.length ? '<div class="sect">K-친화기업 채용컨설팅 — '+K.length+'개 기업</div>'+
                  '<div class="grid">'+K.map(card).join('')+'</div>' : '');
    $('t1').textContent = list.length;
    $('t2').textContent = all.length;
    $('s4').textContent = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    $('hub').innerHTML = '<div class="empty">기업 목록을 불러오지 못했습니다. <small>'+esc(e.message)+'</small></div>';
  }
}

function boot(){
  const isHub = !!document.getElementById('hub');
  const run = isHub ? initHubPage : initCompanyPage;
  run();
  const btn = document.getElementById('reload');
  if(btn) btn.addEventListener('click', run);
  addEventListener('resize', function(){
    if(isHub || !window.__rows) return;
    clearTimeout(window._rz);
    window._rz = setTimeout(function(){
      drawCloud($('c1'), keywords(window.__rows.map(r=>r.q1)), PAL1);
      drawCloud($('c2'), keywords(window.__rows.map(r=>r.q2)), PAL2);
    }, 220);
  });
  setInterval(run, 5*60*1000);   // 5분마다 자동 반영
}
boot();
