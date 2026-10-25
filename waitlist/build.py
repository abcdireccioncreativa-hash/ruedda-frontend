# Genera waitlist/colombia.html y waitlist/canada.html desde una sola plantilla.
# Uso: python3 waitlist/build.py   (desde la raíz del repo)
import os

SUPA = 'https://ltodsegzbbdcaublkgtp.supabase.co'
ANON = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24i'
        'LCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w')

PAISES = {
    'colombia': dict(
        lang='es-CO', title='Ruedda Colombia', pais='colombia', place='colombia',
        desc='El mercado automotriz de Colombia. Por invitación.',
        h1='el mercado automotriz<br>de colombia.', h2='por invitación.',
        ph='tu correo', cta='solicitar acceso', busy='enviando',
        ok='estás dentro.', okn='n.º', oks='te escribimos primero.',
        err='revisa tu correo e inténtalo de nuevo.', net='sin conexión. inténtalo de nuevo.',
        foot='venezuela · colombia · canadá',
    ),
    'canada': dict(
        lang='en-CA', title='Ruedda Canada', pais='canada', place='canada',
        desc="Canada's car market. By invitation.",
        h1="canada's<br>car market.", h2='by invitation.',
        ph='your email', cta='request access', busy='sending',
        ok="you're in.", okn='no.', oks="we'll write to you first.",
        err='check your email and try again.', net='no connection. try again.',
        foot='venezuela · colombia · canada',
    ),
}

TPL = open(os.path.join(os.path.dirname(__file__), 'plantilla.html'), encoding='utf-8').read()

for slug, c in PAISES.items():
    html = TPL
    for k, v in {**c, 'supa': SUPA, 'anon': ANON}.items():
        html = html.replace('{{' + k + '}}', v)
    assert '{{' not in html, slug
    open(os.path.join(os.path.dirname(__file__), slug + '.html'), 'w', encoding='utf-8').write(html)
    print(slug, len(html.encode()), 'bytes')
