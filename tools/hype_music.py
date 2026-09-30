#!/usr/bin/env python3
"""
The hype film's score, synthesised from nothing to the film's own timeline, so
every cut lands on a beat and nothing needs a licence.

  python3 tools/hype_music.py renders/hype/timeline.json out.wav

120 BPM in D minor, i VI III VII (Dm Bb F C) a bar each. A plucked string
(Karplus-Strong) carries a desert motif; drums build by section: none in the
intro, half time under the sky clocks, four on the floor for the machines,
everything for the places, a riser and a drop into the day, and a last hit.
"""
import json, sys, math
import numpy as np

SR = 44100
tl = json.load(open(sys.argv[1]))
out_path = sys.argv[2]
BPM = tl['bpm']; BEAT = 60.0 / BPM
N = int(tl['seconds'] * SR) + SR * 2
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(317)

def at(beat): return int(round(beat * BEAT * SR))
def add(sig, beat, gain=1.0, pan=0.0):
    i = at(beat); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * gain
    L[i:j] += s * math.cos((pan + 1) * math.pi / 4) * 1.414
    R[i:j] += s * math.sin((pan + 1) * math.pi / 4) * 1.414

def env(n, a=0.005, d=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) if a > 0 else np.ones(n)
    if d: e = e * np.exp(-t / d)
    return e
def onepole(x, cutoff):
    # simple low pass; cutoff may be an array
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * math.pi * c / SR)
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y
def hp(x, cutoff): return x - onepole(x, cutoff)
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---- instruments
def kick():
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 44 + 110 * np.exp(-t / 0.035)
    ph = 2 * math.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.2) + 0.12 * np.exp(-t / 0.003) * rng.standard_normal(n)
    return np.tanh(s * 1.6)
KICK = kick()
def clap():
    n = int(0.25 * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    e = np.exp(-t / 0.06)
    for off in (0.0, 0.011, 0.022): e = e + (t >= off) * np.exp(-np.maximum(t - off, 0) / 0.008) * 0.6
    s = onepole(hp(nz, 900), 5000) * e
    return s * 0.32
CLAP = clap()
def hat(open_=False):
    n = int((0.18 if open_ else 0.04) * SR); t = np.arange(n) / SR
    s = hp(rng.standard_normal(n), 7000) * np.exp(-t / (0.07 if open_ else 0.012))
    return s * 0.13
HAT, OHAT = hat(), hat(True)
def boom():
    n = int(2.2 * SR); t = np.arange(n) / SR
    f = 32 + 60 * np.exp(-t / 0.08)
    s = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    s += onepole(rng.standard_normal(n), 400 + 3000 * np.exp(-t / 0.2)) * np.exp(-t / 0.5) * 0.5
    return np.tanh(s * 1.3)
BOOM = boom()
def riser(beats):
    n = at(beats); t = np.arange(n) / n
    s = onepole(onepole(rng.standard_normal(n), 300 + 7000 * t ** 2), 300 + 7000 * t ** 2) * t ** 2
    s += np.sin(2 * math.pi * np.cumsum(200 + 900 * t ** 2) / SR) * 0.15 * t ** 3
    return s * 0.7
def pluck(freq, dur, bright=0.5):
    # Karplus-Strong: a desert twang
    n = int(dur * SR); p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p) * 0.8
    out = np.zeros(n); k = 0.5 * (0.994 + 0.005 * bright)
    for i in range(n):
        v = buf[i % p]; out[i] = v
        buf[i % p] = k * (v + buf[(i + 1) % p])
    return out * env(n, 0.002)
def saw(freq, dur, detune=0.0, cutoff=1400, a=0.01, d=None):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for dt in ((-detune, 0, detune) if detune else (0,)):
        f = freq * (1 + dt)
        s += 2 * ((t * f + rng.random()) % 1) - 1
    s /= (3 if detune else 1)
    return onepole(onepole(s, cutoff), cutoff) * env(n, a, d)
def square_pluck(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sign(np.sin(2 * math.pi * freq * t)) * 0.5 + np.sin(2 * math.pi * freq * 2 * t) * 0.3
    c = 2000 * np.exp(-t / 0.08) + 300
    return onepole(onepole(s, c), c) * np.exp(-t / 0.12)

# ---- harmony: Dm Bb F C, a bar (4 beats) each
CH = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]]
ROOT = [38, 34, 41, 36]
PENT = [62, 65, 67, 69, 72, 74, 77]           # D minor pentatonic, upper
def chord_at(beat): return int(beat // 4) % 4

# ---- sections
secs = tl['sections']
def spans(name): return [(s['start'], s['start'] + s['beats']) for s in secs if s['section'] == name]
def section_of(beat):
    for s in secs:
        if s['start'] <= beat < s['start'] + s['beats']: return s['section']
    return 'end'
total_beats = tl['beats']

# pad under everything but the machines' middle, sidechained later
for bar in range(0, int(total_beats) // 4 + 2):
    b = bar * 4; sec = section_of(b)
    if sec in ('machines',): continue
    for m in CH[bar % 4]:
        sig = saw(midi(m), 4 * BEAT + 0.3, detune=0.004, cutoff=900 if sec != 'places' else 1500, a=0.25, d=None)
        sig *= np.minimum(1, (len(sig) - np.arange(len(sig))) / (0.25 * SR))
        add(sig, b, 0.07 if sec != 'end' else 0.09, pan=(m % 3 - 1) * 0.4)

# desert motif on the plucked string: intro, sky, places, end
MOTIF = [(0, 74, 1.5), (1.5, 72, 0.5), (2, 69, 1), (3, 67, 1), (4, 69, 1.5), (5.5, 67, 0.5), (6, 65, 1), (7, 62, 1)]
for name, gain in (('intro', 0.5), ('sky', 0.38), ('places', 0.3), ('end', 0.45)):
    for (s0, s1) in spans(name):
        b = s0
        while b < s1:
            for off, m, dur in MOTIF:
                if b + off < s1: add(pluck(midi(m - 12 if name == 'places' else m), dur * BEAT + 0.6, 0.7), b + off, gain, pan=0.25)
            b += 8

# arp: eighths in the sky, sixteenths from the machines on
for (s0, s1) in spans('sky') + spans('machines') + spans('places') + spans('finale'):
    sec = section_of(s0); stepb = 0.5 if sec == 'sky' else 0.25
    b = s0; i = 0
    while b < s1 - 1e-6:
        c = CH[chord_at(b)]; m = c[i % 3] + 12 * (1 + (i // 3) % 2)
        g = 0.12 if sec != 'finale' else 0.12 * (0.3 + 0.7 * (b - s0) / (s1 - s0))
        add(square_pluck(midi(m), 0.25), b, g, pan=0.5 if i % 2 else -0.5)
        add(square_pluck(midi(m), 0.25), b + 0.75, g * 0.35, pan=-0.5 if i % 2 else 0.5)   # dotted echo
        b += stepb; i += 1

# bass: roots on the beat in the sky, driving eighths after
for (s0, s1) in spans('sky') + spans('machines') + spans('places') + spans('finale'):
    sec = section_of(s0); stepb = 1 if sec == 'sky' else 0.5
    b = s0
    while b < s1 - 1e-6:
        r = ROOT[chord_at(b)] + (12 if (sec != 'sky' and int(b * 2) % 4 == 3) else 0)
        add(saw(midi(r), stepb * BEAT * 0.9, cutoff=500, a=0.004, d=0.25), b, 0.42)
        b += stepb

# lead in the places: a saw line an octave up on the motif
for (s0, s1) in spans('places'):
    b = s0 + 8
    while b < s1:
        for off, m, dur in MOTIF:
            if b + off < s1: add(saw(midi(m), dur * BEAT, detune=0.006, cutoff=2600, a=0.01, d=0.5), b + off, 0.09, pan=-0.2)
        b += 16

# drums
kick_times = []
for bt in range(int(total_beats)):
    sec = section_of(bt)
    if sec == 'sky':
        if bt % 2 == 0: add(KICK, bt, 0.9); kick_times.append(bt)
        add(HAT, bt + 0.5, 0.8, pan=0.3)
        if bt % 4 == 3: add(CLAP, bt, 0.6)
    elif sec in ('machines', 'places', 'finale'):
        add(KICK, bt, 1.0); kick_times.append(bt)
        if bt % 2 == 1: add(CLAP, bt, 0.75)
        for q in (0.25, 0.5, 0.75): add(HAT, bt + q, 0.55 if q != 0.5 else 0.8, pan=0.3)
        if sec != 'machines': add(OHAT, bt + 0.5, 0.5, pan=-0.3)
    elif sec == 'card':
        # a snare roll and a riser into the next section
        for q in np.arange(0, 2, 0.125): add(CLAP, bt + q if bt + q < total_beats else bt, 0.12 + 0.2 * (q / 2))

for s in secs:
    if s['section'] == 'card':
        add(riser(s['beats']), s['start'], 0.55)
    if s['section'] in ('sky', 'machines', 'places', 'finale', 'end'):
        add(BOOM, s['start'], 0.8 if s['section'] != 'end' else 1.0)
fin = spans('finale')
if fin: add(riser(fin[0][1] - fin[0][0]), fin[0][0], 0.45)

# sidechain: duck everything but the kick itself a touch after every kick
duck = np.ones(N)
for kt in kick_times:
    i = at(kt); n = int(0.22 * SR); j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - 0.45 * np.exp(-np.arange(j - i) / (0.07 * SR)))
L *= duck; R *= duck
for kt in kick_times: pass

# master: soft clip, fade the tail, normalise
end_s = tl['seconds']
t = np.arange(N) / SR
fade = np.clip((end_s + 1.2 - t) / 2.5, 0, 1)
L *= fade; R *= fade
L = np.tanh(L * 1.1); R = np.tanh(R * 1.1)
peak = max(np.abs(L).max(), np.abs(R).max()); L /= peak * 1.12; R /= peak * 1.12
n_out = int((end_s + 0.5) * SR)
st = (np.stack([L[:n_out], R[:n_out]], 1) * 32767).astype('<i2')
import wave
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print('wrote', out_path, round(n_out / SR, 1), 's')
