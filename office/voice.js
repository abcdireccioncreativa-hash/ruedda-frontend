'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — chat de voz por cercanía (WebRTC P2P).
   · Audio directo navegador a navegador (malla: con 4–8 personas sobra).
   · La señalización (offer/answer/ICE) viaja por el canal de tiempo real
     de la oficina; nada de audio pasa por servidores propios.
   · El volumen de cada persona depende de la distancia en el mapa:
     cerca = fuerte, a ~16 tiles deja de oírse. Indicador de quién habla.
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO;
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const NEAR = 56, FAR = 260;      // px de mundo: volumen 1 hasta NEAR, 0 desde FAR
const V = RO.Voice = { on: false, stream: null, peers: new Map(), ac: null };
const me = () => RO.S.me && RO.S.me.user_id;
const send = (to, k, extra) => RO.Net.send(Object.assign({ t: 'rtc', u: me(), to, k }, extra || {}));

function audioCtx() { if (!V.ac) V.ac = new (window.AudioContext || window.webkitAudioContext)(); if (V.ac.state === 'suspended') V.ac.resume(); return V.ac; }
function meter(stream, onLevel) {
  try {
    const src = audioCtx().createMediaStreamSource(stream), an = V.ac.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const iv = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) { const x = (v - 128) / 128; s += x * x; } onLevel(Math.sqrt(s / buf.length)); }, 120);
    return () => { clearInterval(iv); try { src.disconnect(); } catch (e) {} };
  } catch (e) { return () => {}; }
}

function peer(uid) {
  let P = V.peers.get(uid); if (P) return P;
  const pc = new RTCPeerConnection({ iceServers: ICE });
  P = { pc, uid, audio: null, stopMeter: null, makingOffer: false, polite: me() > uid };
  V.peers.set(uid, P);
  if (V.stream) V.stream.getTracks().forEach(t => pc.addTrack(t, V.stream));
  pc.onicecandidate = e => { if (e.candidate) send(uid, 'ice', { cand: e.candidate.toJSON() }); };
  pc.onnegotiationneeded = async () => {
    try { P.makingOffer = true; await pc.setLocalDescription(); send(uid, 'sdp', { sdp: pc.localDescription }); }
    catch (e) { console.warn('[voz] negociación', e); } finally { P.makingOffer = false; }
  };
  pc.ontrack = e => {
    const stream = e.streams[0] || new MediaStream([e.track]);
    if (!P.audio) { P.audio = new Audio(); P.audio.autoplay = true; P.audio.playsInline = true; document.body.appendChild(P.audio); }
    P.audio.srcObject = stream; P.audio.volume = 0; P.audio.play().catch(() => {});
    if (P.stopMeter) P.stopMeter();
    P.stopMeter = meter(stream, lv => RO.G.setTalking && RO.G.setTalking(uid, lv > 0.035 && P.audio && P.audio.volume > 0.05));
  };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) drop(uid); else if (pc.connectionState === 'disconnected') setTimeout(() => { if (pc.connectionState === 'disconnected') { try { pc.restartIce(); } catch (e) {} } }, 3000); };
  return P;
}
function drop(uid) {
  const P = V.peers.get(uid); if (!P) return;
  V.peers.delete(uid);
  try { P.pc.close(); } catch (e) {}
  if (P.stopMeter) P.stopMeter();
  if (P.audio) { P.audio.srcObject = null; P.audio.remove(); }
  RO.G.setTalking && RO.G.setTalking(uid, false);
}

// señalización (negociación "perfecta": sin choques aunque ambos ofrezcan a la vez)
V.onSignal = async m => {
  if (m.to && m.to !== me()) return;
  if (m.k === 'join') { if (V.on) { peer(m.u); send(m.u, 'hi'); } return; }
  if (m.k === 'hi') { if (V.on) peer(m.u); return; }
  if (m.k === 'leave') { drop(m.u); return; }
  if (!V.on) return;
  const P = peer(m.u), pc = P.pc;
  try {
    if (m.k === 'sdp') {
      const collision = m.sdp.type === 'offer' && (P.makingOffer || pc.signalingState !== 'stable');
      if (collision && !P.polite) return;
      await pc.setRemoteDescription(m.sdp);
      if (m.sdp.type === 'offer') { await pc.setLocalDescription(); send(m.u, 'sdp', { sdp: pc.localDescription }); }
    } else if (m.k === 'ice') {
      try { await pc.addIceCandidate(m.cand); } catch (e) { /* llega antes del sdp: se ignora */ }
    }
  } catch (e) { console.warn('[voz]', e); }
};

V.start = async () => {
  if (V.on) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { RO.UI.toast('Este navegador no permite micrófono', 'err'); return false; }
  try { V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { RO.UI.toast('Sin permiso de micrófono. Actívalo en el candado de la barra de direcciones.', 'err'); return false; }
  V.on = true; audioCtx();
  V.stopMine = meter(V.stream, lv => RO.G.setTalking && RO.G.setTalking(me(), lv > 0.04));
  send(null, 'join');
  RO.emit('voice', true);
  return true;
};
V.stop = () => {
  if (!V.on) return;
  V.on = false; send(null, 'leave');
  Array.from(V.peers.keys()).forEach(drop);
  if (V.stopMine) V.stopMine();
  if (V.stream) V.stream.getTracks().forEach(t => t.stop());
  V.stream = null; RO.G.setTalking && RO.G.setTalking(me(), false);
  RO.emit('voice', false);
};
V.toggle = () => V.on ? (V.stop(), false) : V.start();
V.mute = m => { if (V.stream) V.stream.getAudioTracks().forEach(t => t.enabled = !m); V.muted = !!m; };

// volumen por distancia (y cierre de quienes ya no están)
setInterval(() => {
  if (!V.on) return;
  const mp = RO.G.mePos && RO.G.mePos(); if (!mp) return;
  V.peers.forEach((P, uid) => {
    if (!RO.S.online.has(uid)) return drop(uid);
    const pp = RO.G.playerPos(uid); if (!P.audio || !pp) return;
    const d = Math.hypot(pp.x - mp.x, pp.y - mp.y);
    const v = d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR);
    P.audio.volume = Math.max(0, Math.min(1, v * v));
  });
}, 150);
addEventListener('beforeunload', () => { if (V.on) send(null, 'leave'); });
})();
