"""기업별 사전질문 페이지 생성기.

구글 시트 「신청+사전질문」의 B열(기업명(넘버링 기준))을 읽어
c/<기업번호>.html 페이지와 c/index.html 목록 페이지를 만든다.

학생 신청·사전질문은 페이지에서 실시간으로 시트를 읽으므로 재생성이 필요 없다.
기업이 추가·변경됐을 때만 다시 실행:

    python generate_pages.py
"""
import csv, html, io, os, re, urllib.request

SHEET_ID = "1yhhG0z90ueUO9cyAHlc4IoCVzCMXvjo8UskltCsXP4c"
GID = "984055483"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&gid={GID}"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "c")

EVENT = "2026. 9. 16.(수) 12:30–16:30 · 경기대학교 수원캠퍼스 실내체육관(제3강의동)"


def split_co(s):
    """'(A)현직자 직무멘토링_01_이랜드팜앤푸드_구매' -> ('01', '이랜드팜앤푸드', '구매')"""
    p = s.split("_")
    return (p[1].strip() if len(p) > 1 else "",
            p[2].strip() if len(p) > 2 else "",
            p[3].strip() if len(p) > 3 else "")


def fetch():
    with urllib.request.urlopen(CSV_URL) as r:
        text = r.read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(text)))
    cos = {}
    for r in rows:
        raw = (r.get("기업명(넘버링 기준)") or "").strip()
        if not raw:
            continue
        num, name, job = split_co(raw)
        if not num:
            continue
        c = cos.setdefault(num, {"num": num, "name": name, "job": job, "n": 0, "zone": raw.split("_")[0]})
        c["n"] += 1
    return sorted(cos.values(), key=lambda c: (c["num"].startswith("C"), c["num"]))


PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="mentor.css">
</head>
<body data-co="{num}">
<header>
  <div class="hd">
    <span class="badge">제11회 직무채용박람회 ‘소통’ · 동문 멘토용</span><span class="booth">{booth}</span>
    <h1>{name}<small>{job}</small></h1>
    <div class="sub">{event} · <a href="index.html">전체 기업 목록</a></div>
  </div>
</header>

<div class="wrap">
  <div class="stats">
    <div class="stat"><b id="s1">–</b><span>신청 학생</span></div>
    <div class="stat o"><b id="s2">–</b><span>사전질문 1 응답</span></div>
    <div class="stat y"><b id="s3">–</b><span>사전질문 2 응답</span></div>
    <div class="stat w"><b id="s4" style="font-size:14px;padding-top:5px">–</b><span>최종 동기화</span></div>
    <button id="reload">↻ 새로고침</button>
  </div>

  <h2>사전질문 리스트</h2>
  <div class="note">학과명 오름차순 정렬 · 구글 시트 「신청+사전질문」 실시간 연동</div>
  <div class="tablebox">
    <div class="scroll"><table>
      <thead><tr>
        <th class="idx">#</th><th>학과</th><th>이름</th><th>학년</th><th>상태 / 시간</th>
        <th style="width:33%">사전질문 1 — 직무 역량 · 인재상</th>
        <th style="width:33%">사전질문 2 — 서류/면접 · 어학 · 자격증</th>
      </tr></thead>
      <tbody id="tb"><tr><td colspan="7" class="empty">데이터를 불러오는 중입니다…</td></tr></tbody>
    </table></div>
  </div>

  <h2>핵심 키워드 워드클라우드</h2>
  <div class="note">이 기업 신청 학생들의 질문에서 추출한 키워드 · 글자 크기 = 언급 빈도</div>
  <div class="clouds">
    <div class="cloudcard">
      <h3>사전질문 1 키워드</h3>
      <div class="cap">희망 직무의 핵심 실무 역량 · 인재상 · 근무환경</div>
      <div class="circle" id="c1"></div>
      <div class="chips" id="k1"></div>
    </div>
    <div class="cloudcard q2">
      <h3>사전질문 2 키워드</h3>
      <div class="cap">서류/면접 준비 전략 · 어학 · 자격증 · 포트폴리오</div>
      <div class="circle q2" id="c2"></div>
      <div class="chips" id="k2"></div>
    </div>
  </div>

  <footer>
    데이터 출처: 구글 스프레드시트 「신청+사전질문」 · 5분마다 자동 갱신<br>
    <a href="index.html">← 전체 기업 목록</a> · <a href="../">통합 보드</a>
  </footer>
</div>
<script src="mentor.js"></script>
</body>
</html>
"""

HUB = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>제11회 직무채용박람회 소통 · 기업별 사전질문 페이지</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="mentor.css">
</head>
<body>
<header>
  <div class="hd">
    <span class="badge">2026 경기대학교 · 인재개발처 대학일자리플러스센터</span>
    <h1>기업별 <span style="color:#ffc247">사전질문</span> 페이지<small>동문 멘토님께 각 기업 링크를 개별 안내해 주세요</small></h1>
    <div class="sub">{event}</div>
  </div>
</header>
<div class="wrap">
  <div class="stats">
    <div class="stat"><b id="t1">–</b><span>참여 기업</span></div>
    <div class="stat o"><b id="t2">–</b><span>신청 학생</span></div>
    <div class="stat w"><b id="s4" style="font-size:14px;padding-top:5px">–</b><span>최종 동기화</span></div>
    <button id="reload">↻ 새로고침</button>
  </div>
  <div id="hub"><div class="empty">기업 목록을 불러오는 중입니다…</div></div>
  <footer>
    데이터 출처: 구글 스프레드시트 「신청+사전질문」 · 5분마다 자동 갱신<br>
    <a href="../">통합 보드(전체 기업 한 화면)</a>
  </footer>
</div>
<script src="mentor.js"></script>
</body>
</html>
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    cos = fetch()
    for c in cos:
        booth = c["num"] if c["num"].startswith("C") else "A" + c["num"]
        page = PAGE.format(
            title=f"{c['name']} · 사전질문 · 제11회 직무채용박람회 소통",
            num=c["num"], booth=html.escape(booth),
            name=html.escape(c["name"]),
            job=html.escape(c["job"] or c["zone"]),
            event=EVENT,
        )
        with io.open(os.path.join(OUT, f"{c['num']}.html"), "w", encoding="utf-8", newline="\n") as f:
            f.write(page)
    with io.open(os.path.join(OUT, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(HUB.format(event=EVENT))

    base = "https://polanyi082.github.io/KYONGGI-UNIVERSITY_JOB-MENTOR/c/"
    lines = ["기업번호\t기업명\t직무\t신청\tURL"]
    for c in cos:
        lines.append(f"{c['num']}\t{c['name']}\t{c['job']}\t{c['n']}\t{base}{c['num']}.html")
    with io.open(os.path.join(OUT, "..", "URL목록.tsv"), "w", encoding="utf-8-sig", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{len(cos)}개 기업 페이지 생성 완료 -> {OUT}")


if __name__ == "__main__":
    main()
