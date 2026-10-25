# Genera waitlist/colombia.html y waitlist/canada.html desde una sola plantilla.
# Uso: python3 waitlist/build.py   (desde la raíz del repo)
import os

SUPA = 'https://ltodsegzbbdcaublkgtp.supabase.co'
ANON = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24i'
        'LCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w')

FORM = '''<form id="f" novalidate>
      <input id="e" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="{{ph}}" aria-label="{{ph}}" required>
      <button id="b" type="submit"><span>{{cta}}</span><i></i></button>
    </form>
    <div id="msg" role="status" aria-live="polite"></div>
    <div id="ok"><b class="cx">{{ok}}</b><p>{{okn}} <em id="n">—</em> &nbsp;·&nbsp; {{oks}}</p></div>'''
ENTER = '''<a class="go" href="/" id="go"><span>{{cta}}</span><i></i><b class="sp"></b></a>
    <a class="ios" href="https://apps.apple.com/app/id6812039590">{{ios}}</a>
    <script>try{sessionStorage.setItem('rd_pre','1');if(/iP(hone|ad|od)/.test(navigator.userAgent))document.documentElement.classList.add('is-ios');}catch(e){}
    var go=document.getElementById('go');go.addEventListener('click',function(ev){if(ev.metaKey||ev.ctrlKey)return;ev.preventDefault();go.classList.add('ld');setTimeout(function(){location.href=go.href;},260);});
    addEventListener('pageshow',function(){go.classList.remove('ld');});</script>'''

PAISES = {
    'venezuela': dict(
        lang='es-VE', title='Ruedda', pais='venezuela', place='venezuela', action=ENTER,
        desc='El mercado automotriz de Venezuela.',
        h1='el mercado automotriz<br>de venezuela.', h2='para quien sabe.',
        cta='entrar', ios='descargar para iphone', foot='hecho en venezuela.', footcls='lc',
        ph='', busy='', ok='', okn='', oks='', err='', net='',
    ),
    'colombia': dict(
        lang='es-CO', action=FORM, title='Ruedda Colombia', pais='colombia', place='colombia',
        desc='El mercado automotriz de Colombia. Acceso anticipado.',
        h1='el mercado automotriz<br>de colombia.', h2='acceso anticipado.',
        ph='tu correo', cta='solicitar acceso', busy='enviando',
        ok='estás dentro.', okn='n.º', oks='te escribimos primero.',
        err='revisa tu correo e inténtalo de nuevo.', net='sin conexión. inténtalo de nuevo.',
        foot='no todos entran.', footcls='',
    ),
    'canada': dict(
        lang='en-CA', action=FORM, title='Ruedda Canada', pais='canada', place='canada',
        desc="Canada's car market. Early access.",
        h1="canada's<br>car market.", h2='early access.',
        ph='your email', cta='request access', busy='sending',
        ok="you're in.", okn='no.', oks="we'll write to you first.",
        err='check your email and try again.', net='no connection. try again.',
        foot='not everyone gets in.', footcls='',
    ),
}

TPL = open(os.path.join(os.path.dirname(__file__), 'plantilla.html'), encoding='utf-8').read()

for slug, c in PAISES.items():
    html = TPL
    for k, v in [('action', c['action'])] + [(k, v) for k, v in {**c, 'supa': SUPA, 'anon': ANON}.items() if k != 'action']:
        html = html.replace('{{' + k + '}}', v)
    assert '{{' not in html, slug
    open(os.path.join(os.path.dirname(__file__), slug + '.html'), 'w', encoding='utf-8').write(html)
    print(slug, len(html.encode()), 'bytes')
