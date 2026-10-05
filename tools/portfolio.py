# Portfolio index and track record, generated from one list of projects.
# Every line carries its source (see CONFIRM.md). Writes the blocks between the
# <!-- ix:start/end --> and <!-- tl:start/end --> markers in index.html, and the
# filter rules between /* ix:start/end */ in styles.css.
#   python3 tools/portfolio.py
import os, re, html
from PIL import Image
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

SECTORS = {'co': 'Companies', 'io': 'International organisations', 'he': 'Healthcare', 'cu': 'Culture and associations'}
KINDS = {'sw': 'Software', 'web': 'Web', 'mob': 'Mobile', '3d': '3D', 'vid': 'Video', 'pub': 'Publications', 'it': 'IT',
         'brand': 'Branding', 'prod': 'Production', 'ill': 'Illustration'}

# year, client, what we made, sector, kinds, case anchor, thumbnail, timeline (date label, datetime, title, line) or None
P = [
 ('2024', 'WIPO', 'Technical partner of the WIPO Global Awards, three years in a row', 'io', ['it'], 'case-wipo', None,
    ('2022', '2022', 'WIPO Global Awards', 'Technical support, renewed in 2023 and 2024.')),
 ('2024', 'WIPO', 'Consulting for the WIPO Global Awards, with dashboards of the entries', 'io', ['sw'], 'case-wipo', 'ix-awardforce',
    ('Jan 2024', '2024-01', 'Consulting for the WIPO Global Awards', 'Dashboards of the entries, on Award Force.')),
 ('', 'WIPO', 'The IP Assessment tool', 'io', ['sw'], 'case-wipo', 'ix-wipo-assess', None),
 ('', 'WIPO', 'WIPO Data Matrix', 'io', ['sw'], 'case-wipo', None, None),
 ('', 'WIPO', 'Support for distance learning', 'io', ['it'], 'case-wipo', None, None),
 ('2025', 'Striker', 'An Android and iOS app for amateur football, launched in February 2025', 'co', ['mob'], 'case-striker', 'ix-striker',
    ('Feb 2025', '2025-02', 'Striker launches', 'Android and iOS, in several European cities.')),
 ('2025', 'ILO', 'Technical support for the conference, May and June 2025', 'io', ['it'], None, None,
    ('May 2025', '2025-05', 'ILO conference', 'Technical support, May and June 2025.')),
 ('2024', 'FuzzeFoot', 'An app for football matches around Geneva', 'co', ['mob'], None, None,
    ('Apr 2024', '2024-04', 'FuzzeFoot app', 'Football matches around Geneva.')),
 ('2023', 'Pizza Brothers', 'A mobile app for ordering, with live delivery times', 'co', ['mob'], None, None,
    ('Nov 2023', '2023-11', 'Pizza Brothers app', 'Published in November 2023.')),
 ('2023', 'UNICEF', 'A tool that tracks medicine use in baby-care units, Sierra Leone', 'he', ['sw'], 'case-sl', 'ix-scbu',
    ('May 2023', '2023-05', 'Newborn care, Sierra Leone', 'A UNICEF tool that tracks medicine use.')),
 ('2022', 'CUAMM', 'A medical-record pilot at PMCH Hospital, Freetown, with the team trained on site', 'he', ['sw'], 'case-sl', None,
    ('Mar 2022', '2022-03', 'Medical records in Freetown', 'A pilot with CUAMM; the hospital team trained on site.')),
 ('2021', 'Portraits of Giants', 'Website and video projections for the exhibition, Geneva', 'cu', ['web', 'vid'], None, 'ix-giants',
    ('2021', '2021', 'Portraits of Giants, Geneva', 'Website and video projections for the exhibition.')),
 ('2020', 'WHO', 'Content for the online platform of the LEAD Innovation Challenge', 'io', ['web'], 'case-who', 'ix-who',
    ('Apr 2020', '2020-04', 'WHO LEAD Innovation Challenge', 'Content for its online platform, at launch.')),
 ('2020', 'WHO · UNICEF', 'A series of videos about an online reporting form', 'io', ['vid'], 'case-who', 'ix-ejrf',
    ('Dec 2020', '2020-12', 'Videos for the WHO and UNICEF', 'A series about an online reporting form.')),
 ('2020', 'Rotel', 'Packaging for new products, among them a fondue set', 'co', ['brand'], None, 'ix-rotel',
    ('Dec 2020', '2020-12', 'Packaging for Rotel', 'New products, among them a fondue set.')),
 ('2020', 'Geneva Guide Association', 'The Visit Geneva website, in English and French', 'cu', ['web'], None, 'ix-geneva-guide',
    ('Jan 2020', '2020-01', 'Visit Geneva website', 'For the Geneva Guide Association, in English and French.')),
 ('2009', 'Caterpillar', 'A dealer locator for the United States and Canada', 'co', ['web'], 'case-cat', None,
    ('2009', '2009', 'A dealer locator for Caterpillar', 'For the United States and Canada.')),
 ('2008', 'Nestlé', 'An animation, shown on the 3D pages of elysium.cc', 'co', ['3d'], 'case-3d', None,
    ('2008', '2008', 'Animations for Nestlé and IMD', 'Shown on the 3D pages of elysium.cc.')),
 ('2008', 'IMD', 'An animation, shown on the 3D pages of elysium.cc', 'co', ['3d'], None, None, None),
 ('2007', 'Caterpillar', 'A dealer toolbox, served from elysium.cc', 'co', ['web'], 'case-cat', None,
    ('2007', '2007', 'A dealer toolbox for Caterpillar', 'Served from elysium.cc.')),
 ('', 'Caterpillar', 'The Dealer Advisor platform', 'co', ['sw'], 'case-cat', None, None),
 ('', 'Caterpillar', '3D models of heavy equipment', 'co', ['3d'], 'case-cat', None, None),
 ('', 'Caterpillar', 'Internal communication tools', 'co', ['sw'], 'case-cat', None, None),
 ('', 'UBS', '3D visualisation of a real-estate project', 'co', ['3d'], 'case-3d', None, None),
 ('', 'Nestlé', '3D visualisation of corporate buildings and factories', 'co', ['3d'], 'case-3d', None, None),
 ('', 'UEFA', 'Motion graphics for the annual meeting', 'co', ['vid'], 'case-uefa', None, None),
 ('2014', 'abm', 'A video for a medical project', 'he', ['vid'], None, 'ix-abm',
    ('Mar 2014', '2014-03', 'A video for abm', 'For a medical project.')),
 ('2014', 'UN Special', 'The cover of the magazine’s March edition', 'io', ['pub'], None, 'ix-unspecial',
    ('Feb 2014', '2014-02', 'UN Special magazine', 'The cover of the March edition.')),
 ('2014', 'Spacecode', 'The mobile version of its website', 'co', ['web', 'mob'], None, 'ix-spacecode-mobile',
    ('Jan 2014', '2014-01', 'Spacecode on mobile', 'The mobile version of its website.')),
 ('2013', 'Marti Construction', 'An update of its website', 'co', ['web'], None, 'ix-marti',
    ('Jun 2013', '2013-06', 'Marti Construction website', 'Updated.')),
 ('2013', 'UEFA', 'A video for an internal presentation', 'co', ['vid'], 'case-uefa', 'ix-uefa',
    ('May 2013', '2013-05', 'A video for UEFA', 'For an internal presentation.')),
 ('2013', 'Spacecode', '3D animations for its product video', 'co', ['3d'], None, 'ix-spacecode-3d',
    ('Apr 2013', '2013-04', '3D animations for Spacecode', 'For its product video.')),
 ('2013', 'REAL GMT', 'A website for real-estate management', 'co', ['web'], None, 'ix-real',
    ('Mar 2013', '2013-03', 'REAL GMT website', 'For real-estate management.')),
 ('2010', 'Women Create Life', 'A stereoscopic 3D greeting card', 'cu', ['3d'], None, None,
    ('Dec 2010', '2010-12', 'A 3D greeting card', 'Stereoscopic, for Women Create Life.')),
 ('2010', 'WHO', 'Presentations for a team’s iPads', 'io', ['pub'], 'case-who', None,
    ('Oct 2010', '2010-10', 'iPad presentations for the WHO', 'For a team that presents its work on iPads.')),
 ('2010', 'Altran', 'A Facebook campaign', 'co', ['web'], None, None,
    ('Sep 2010', '2010-09', 'A Facebook campaign for Altran', 'Social media.')),
 ('2010', 'Caterpillar', 'CAT Video, a video website', 'co', ['web', 'vid'], 'case-cat', None,
    ('2010', '2010-11', 'CAT Video', 'A video website for Caterpillar.')),
 ('', 'WHO', 'IT consulting', 'io', ['it'], 'case-who', None, None),
 ('', 'WHO', 'Websites', 'io', ['web'], 'case-who', None, None),
 ('', 'WHO', 'Communication material', 'io', ['pub'], 'case-who', None, None),
 ('', 'WHO', 'Motion graphics', 'io', ['vid'], 'case-who', None, None),
 ('', 'WHO', '3D simulation of a medical device', 'io', ['3d'], 'case-who', None, None),
 ('', 'GIA', 'A mobile app', 'co', ['mob'], 'case-gia', 'ix-gia', None),
 ('', 'GIA', 'Diamond-origin software and publication platform', 'co', ['sw'], 'case-gia', None, None),
 ('', 'ILO', 'Digital and printed publications', 'io', ['pub'], None, None, None),
 ('', 'ILO', 'IT support for the annual conference', 'io', ['it'], None, None, None),
 ('', 'UNICEF', 'Publications and communication material', 'io', ['pub'], None, None, None),
 ('', 'Medtronic', 'A mobile app for the sales team', 'co', ['mob'], None, None, None),
 ('', 'BLU Healthcare', 'A clinical health-records platform', 'he', ['sw'], None, 'ix-blu', None),
 ('', 'LetsMed', 'A digital catalogue of medical products, with remote stock monitoring', 'he', ['sw'], None, None, None),
 ('', 'Minga RUNNER', 'A training audit from Garmin and Strava data, in English, Spanish and Portuguese', 'co', ['sw'], None, None, None),
 ('', 'Faro Investors', 'An investor-relations website', 'co', ['web'], None, None, None),
 ('', 'Fenix Securities', 'Brand and disclosure structure', 'co', ['brand'], None, None, None),
 ('', 'A not-for-profit organisation', 'A 3D virtual gallery', 'cu', ['3d'], None, 'ix-gallery', None),
 ('', 'A UN organisation', 'Motion graphics videos', 'io', ['vid'], None, 'ix-un-motion', None),
 ('', 'A partner agency', 'Interface design for a stock-scanning app', 'co', ['mob'], None, 'ix-stockscan', None),
]
# timeline lines with no index row of their own
EXTRA_TL = [
 ('2002', '2002', 'elysium.cc goes live', 'The domain’s first archived copy, August 2002.'),
 ('2005', '2005', 'Elysium is founded', 'In Geneva.'),
 ('2010', '2010', '22 clients on elysium.cc', 'Among them Bobst, Braun, the ITU and the Order of Malta.'),
 ('2026', '2026', 'Private AI servers', 'In preparation at Elysium Labs, Zürich.'),
]
ARCH = {'3d': 14, 'web': 14, 'brand': 9, 'prod': 9, 'ill': 7, 'pub': 5, 'mob': 4, 'vid': 3, 'it': 3}
ARCH_FILES = {'3d': '3d', 'web': 'web', 'brand': 'branding', 'prod': 'production', 'ill': 'illustration', 'pub': 'publications', 'mob': 'mobile', 'vid': 'video', 'it': 'it'}

e = lambda s: html.escape(s, quote=False)
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

# ---- counts
cnt = {f's-{k}': 0 for k in SECTORS} | {f'k-{k}': 0 for k in KINDS}
for y, c, w, s, ks, case, th, tl in P:
    cnt[f's-{s}'] += 1
    for k in ks: cnt[f'k-{k}'] += 1
arch_files = []
for k, n in ARCH.items():
    folder = os.path.join(R, 'assets', 'portfolio')
    files = sorted(f for f in os.listdir(folder) if f.startswith(ARCH_FILES[k] + '_') and f.endswith('.jpg'))
    arch_files += [(k, f) for f in files]
    cnt[f'k-{k}'] += len(files)
total = len(P) + len(arch_files)

# ---- index
ids = set()
rows = []
for y, c, w, s, ks, case, th, tl in sorted(P, key=lambda r: -int(r[0] or 0)):   # newest first, undated last
    rid = 'ix-' + slug(c + '-' + w)
    while rid in ids: rid += '-b'
    ids.add(rid)
    f = ' '.join([f's-{s}'] + [f'k-{k}' for k in ks])
    name = f'<a href="#{case}">{e(c)}</a>' if case else e(c)
    if th: tw, tht = Image.open(os.path.join(R, 'assets', 'work', th + '.jpg')).size
    img = f'<img class="ix-th" src="assets/work/{th}.jpg" width="{tw}" height="{tht}" loading="lazy" decoding="async" alt="">' if th else ''
    kind = ' · '.join(KINDS[k] for k in ks)
    has = ' class="has-th"' if th else ''
    rows.append(f'      <li id="{rid}" data-f="{f}"{has}><span class="ix-y mono">{y or "—"}</span>'
                f'<span class="ix-c">{name}</span><span class="ix-w">{e(w)}</span><span class="ix-k label">{kind}</span>{img}</li>')
tiles = [f'      <li data-f="k-{k}"><img src="assets/portfolio/{f}" width="130" height="130" loading="lazy" decoding="async" alt="Archive piece: {KINDS[k]}"></li>'
         for k, f in arch_files]
chips = [f'<a class="chip-f" href="#f-all">All <span class="mono">{total}</span></a>']
chips += [f'<a class="chip-f" href="#f-s-{k}">{e(v)} <span class="mono">{cnt["s-" + k]}</span></a>' for k, v in SECTORS.items()]
chips += ['<i class="chip-sep" aria-hidden="true"></i>']
chips += [f'<a class="chip-f" href="#f-k-{k}">{e(v)} <span class="mono">{cnt["k-" + k]}</span></a>' for k, v in KINDS.items() if cnt['k-' + k]]
anchors = ''.join(f'<i class="ix-t" id="f-{k}"></i>' for k in ['all'] + [f's-{k}' for k in SECTORS] + [f'k-{k}' for k in KINDS])
IX = f'''<!-- ix:start -->
  <div class="ix wrap cols" id="index">
    <div class="ix-head"><h3>Index of projects</h3><p class="label">{len(P)} named projects and {len(arch_files)} archive pieces · filter by sector or by kind of work</p></div>
    {anchors}
    <nav class="ix-chips fade-x" aria-label="Filter the index">{"".join(chips)}</nav>
    <ol class="ix-list">
{chr(10).join(rows)}
    </ol>
    <p class="ix-arch-h label">Archive · pieces published on elysium.cc by 2014, clients not recorded</p>
    <ul class="ix-arch">
{chr(10).join(tiles)}
    </ul>
  </div>
<!-- ix:end -->'''

# ---- timeline: every dated line, oldest first
tl = [t for *_, t in P if t] + EXTRA_TL
seen, items = set(), []
for d, dt, h, p in sorted(tl, key=lambda t: t[1]):
    if h in seen: continue
    seen.add(h)
    items.append(f'              <li><time datetime="{dt}">{e(d)}</time><h4>{e(h)}</h4><p>{e(p)}</p></li>')
TL = '<!-- tl:start -->\n' + '\n'.join(items) + '\n              <!-- tl:end -->'

# ---- filter rules: CSS :target, so the filter works without JS and the URL keeps it
keys = [f's-{k}' for k in SECTORS] + [f'k-{k}' for k in KINDS]
CSS = '/* ix:start */\n' + '\n'.join(
    f'#f-{k}:target~.ix-list>li:not([data-f~="{k}"]),#f-{k}:target~.ix-arch>li:not([data-f~="{k}"]){{display:none}}'
    f'#f-{k}:target~.ix-chips a[href="#f-{k}"]{{background:var(--text);color:var(--void)}}' for k in keys) + \
    '\n.ix-t[id^="f-s-"]:target~.ix-arch-h{display:none}\n/* ix:end */'

def put(path, a, b, block):
    s = open(path).read()
    i, j = s.index(a), s.index(b) + len(b)
    open(path, 'w').write(s[:i] + block + s[j:])
put(os.path.join(R, 'index.html'), '<!-- ix:start -->', '<!-- ix:end -->', IX)
put(os.path.join(R, 'index.html'), '<!-- tl:start -->', '<!-- tl:end -->', TL)
put(os.path.join(R, 'styles.css'), '/* ix:start */', '/* ix:end */', CSS)
print(f'{len(P)} projects, {len(arch_files)} archive pieces, {len(items)} timeline lines;', {k: v for k, v in cnt.items() if v})
