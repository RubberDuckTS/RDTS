"""Repaint a textured Tripo GLB in flat logo colours.

Every face is labelled with the nearest palette colour of its texture (samples at
its corners and centre), stray strokes and specks are voted away by the faces
around them, and the result is written as one flat-colour part per colour, with
no texture. Usage: python flatpaint.py in.glb out.glb name=#hex,... [passes]
"""
import io, json, struct, sys
import numpy as np
from PIL import Image

src, dst, pal_arg = sys.argv[1], sys.argv[2], sys.argv[3]
passes = int(sys.argv[4]) if len(sys.argv) > 4 else 4
pal = [(n, h) for n, h in (p.split('=') for p in pal_arg.split(','))]
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
PAL = np.array([hexrgb(h) for _, h in pal])            # what the texture looks like
OUT = {n: h for n, h in pal}

b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
b0 = 20 + jl + 8
def view(i):
    bv = j['bufferViews'][i]; o = b0 + bv.get('byteOffset', 0)
    return b[o:o + bv['byteLength']]
def acc(i):
    a = j['accessors'][i]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    bv = j['bufferViews'][a['bufferView']]
    raw = np.frombuffer(view(a['bufferView']), dtype=dt, offset=a.get('byteOffset', 0), count=a['count'] * n)
    return raw.reshape(a['count'], n) if n > 1 else raw
pr = j['meshes'][0]['primitives'][0]
P = acc(pr['attributes']['POSITION']).astype(np.float32)
N = acc(pr['attributes']['NORMAL']).astype(np.float32)
UV = acc(pr['attributes']['TEXCOORD_0']).astype(np.float32)
F = acc(pr['indices']).astype(np.int64).reshape(-1, 3)
img = Image.open(io.BytesIO(view(j['images'][0]['bufferView']))).convert('RGB')
T = np.asarray(img, float); H, W = T.shape[:2]

def sample(uv):
    x = np.clip((uv[:, 0] % 1) * W, 0, W - 1).astype(int); y = np.clip((uv[:, 1] % 1) * H, 0, H - 1).astype(int)
    # a little box blur so a single dirty texel does not decide
    acc_ = np.zeros((len(uv), 3))
    for dx in (-2, 0, 2):
        for dy in (-2, 0, 2):
            acc_ += T[np.clip(y + dy, 0, H - 1), np.clip(x + dx, 0, W - 1)]
    return acc_ / 9
def label(rgb):
    d = ((rgb[:, None, :] - PAL[None]) ** 2).sum(-1)
    return d.argmin(1)

UNK = [k for k, (n, _) in enumerate(pal) if n == 'stroke']
cuv = [UV[F[:, k]] for k in range(3)] + [UV[F].mean(1)] + [(UV[F[:, 0]] + UV[F[:, 1]] + 2 * UV[F[:, 2]]) / 4, (2 * UV[F[:, 0]] + UV[F[:, 1]] + UV[F[:, 2]]) / 4, (UV[F[:, 0]] + 2 * UV[F[:, 1]] + UV[F[:, 2]]) / 4]
votes = np.stack([label(sample(u)) for u in cuv], 1)
K = len(pal)
cnt = np.stack([(votes == k).sum(1) for k in range(K)], 1)
for u in UNK: cnt[:, u] = 0
lab = np.where(cnt.max(1) > 0, cnt.argmax(1), -1)

# Face neighbours across shared edges (vertices merged by position, since UV seams split them).
key = np.round(P / float(__import__("os").environ.get("WELD", "0.0001"))).astype(np.int64)
_, vid = np.unique(key, axis=0, return_inverse=True)
vid = vid.ravel(); G = vid[F]
edges = {}
for f, (a, b_, c) in enumerate(G):
    for e in ((a, b_), (b_, c), (c, a)):
        edges.setdefault((min(e), max(e)), []).append(f)
print('boundary edges', sum(1 for v in edges.values() if len(v)==1), 'nonmanifold', sum(1 for v in edges.values() if len(v)>2))
nb = [[] for _ in range(len(F))]
for fs in edges.values():
    for x in fs:
        nb[x].extend(y for y in fs if y != x)

def vote(lab, fill_only):
    new = lab.copy()
    for f in range(len(F)):
        if fill_only and lab[f] >= 0: continue
        ls = [lab[g] for g in nb[f] if lab[g] >= 0]
        if not ls: continue
        v, c = np.unique(ls, return_counts=True)
        if fill_only or (c.max() >= 2 and v[c.argmax()] != lab[f]): new[f] = v[c.argmax()]
    return new
for _ in range(12):
    if (lab < 0).sum() == 0: break
    lab = vote(lab, True)
lab[lab < 0] = 0
for _ in range(passes): lab = vote(lab, False)

# Keep only real features: stray patches (seam stripes in the texture atlas) go back to
# the colour around them. keep=name:minfaces[:largest] e.g. orange:200:1 keeps the largest orange part.
keep = dict()
for kv in (sys.argv[6].split(',') if len(sys.argv) > 6 else []):
    n, mn, *lg = kv.split(':'); keep[n] = (int(mn), bool(lg and lg[0] == '1'), float(lg[1]) if len(lg) > 1 else 9e9)
def components(mask):
    comp = -np.ones(len(F), int); cid = 0
    for f in np.flatnonzero(mask):
        if comp[f] >= 0: continue
        st = [f]; comp[f] = cid
        while st:
            x = st.pop()
            for y in nb[x]:
                if mask[y] and comp[y] < 0: comp[y] = cid; st.append(y)
        cid += 1
    return comp, cid
for k, n in enumerate([n for n, _ in pal]):
    if n not in keep: continue
    mn, largest, maxext = keep[n]
    comp, nc = components(lab == k)
    sizes = np.bincount(comp[comp >= 0], minlength=nc)
    ok = sizes >= mn
    ext = np.array([np.ptp(P[F[comp == c]].reshape(-1, 3), 0).max() if sizes[c] else 0 for c in range(nc)])
    ok = ok & (ext <= maxext)
    if largest and ok.any(): ok = ok & (sizes == sizes[ok].max())
    bad = (comp >= 0) & ~ok[np.maximum(comp, 0)]
    lab[bad] = -1
    cent = [(int(sizes[c]), np.round(P[F[comp == c]].reshape(-1, 3).mean(0), 2).tolist(), np.round(np.ptp(P[F[comp == c]].reshape(-1, 3), 0), 2).tolist()) for c in np.flatnonzero(ok)]
    print(f'{n}: {nc} parts, kept', cent)
for _ in range(40):
    if (lab < 0).sum() == 0: break
    lab = vote(lab, True)
lab[lab < 0] = 0

# Make the triangle winding consistent (generated meshes mix it, which lets a
# back-face outline hull show through the surface), then point it outward.
from collections import deque
directed = {}
for f, (a, b_, c) in enumerate(G):
    for e in ((a, b_), (b_, c), (c, a)): directed.setdefault((min(e), max(e)), []).append((f, e[0] < e[1]))
flip = np.zeros(len(F), bool); seen = np.zeros(len(F), bool); nflip = 0
for start in range(len(F)):
    if seen[start]: continue
    seen[start] = True; q = deque([start]); comp = [start]
    while q:
        f = q.popleft()
        a, b_, c = G[f]
        for e in ((a, b_), (b_, c), (c, a)):
            lst = directed[(min(e), max(e))]
            if len(lst) != 2: continue
            fwd_f = (e[0] < e[1]) ^ flip[f]
            for g, fwd in lst:
                if g == f or seen[g]: continue
                # neighbours must traverse the shared edge in opposite directions
                flip[g] = (fwd == fwd_f)
                seen[g] = True; q.append(g); comp.append(g)
    comp = np.array(comp); Gc = G[comp].copy(); Gc[flip[comp]] = Gc[flip[comp]][:, ::-1]
    vol = np.einsum('ij,ij->i', P[F[comp, 0]] * 0 + np.array([0.0]), np.zeros((len(comp), 3)))  # placeholder
    pa, pb, pc = (np.array([P[F[comp][k, i]] for k in range(len(comp))]) for i in range(3))
    sign = np.where(flip[comp], -1, 1)
    v = (np.einsum('ij,ij->i', pa, np.cross(pb, pc)) * sign).sum()
    if v < 0: flip[comp] = ~flip[comp]
F[flip] = F[flip][:, ::-1]; G[flip] = G[flip][:, ::-1]
print('flipped faces', int(flip.sum()))

# Smooth the generated surface (it is lumpy, which breaks toon bands and the outline),
# then rebuild normals welded across seams.
smooth_iters = int(sys.argv[5]) if len(sys.argv) > 5 else 6
nv = vid.max() + 1
Pm = np.zeros((nv, 3)); np.add.at(Pm, vid, P); cntv = np.bincount(vid, minlength=nv)[:, None]; Pm /= cntv
E = np.array(list(edges.keys()))
deg = np.bincount(E.ravel(), minlength=nv)[:, None].astype(float)
for it in range(smooth_iters):
    for lam in (0.5, -0.53):  # Taubin: smooth without shrinking
        nbsum = np.zeros_like(Pm); np.add.at(nbsum, E[:, 0], Pm[E[:, 1]]); np.add.at(nbsum, E[:, 1], Pm[E[:, 0]])
        Pm = Pm + lam * (nbsum / np.maximum(deg, 1) - Pm)
# Fill grooves: vertices that sit well below their neighbours (a valley where the
# generator joined two halves) are relaxed many times, with a couple of rings around them.
crease = float(__import__('os').environ.get('CREASE', '0'))
if crease > 0:
    def vnormals(Q):
        fn_ = np.cross(Q[G[:, 1]] - Q[G[:, 0]], Q[G[:, 2]] - Q[G[:, 0]]); Nq = np.zeros((nv, 3))
        for k in range(3): np.add.at(Nq, G[:, k], fn_)
        return Nq / (np.linalg.norm(Nq, axis=1, keepdims=True) + 1e-12)
    nbsum = np.zeros_like(Pm); np.add.at(nbsum, E[:, 0], Pm[E[:, 1]]); np.add.at(nbsum, E[:, 1], Pm[E[:, 0]])
    lapv = nbsum / np.maximum(deg, 1) - Pm
    concave = (lapv * vnormals(Pm)).sum(1)   # > 0: the neighbours sit above the vertex
    sel = concave > crease
    for _ in range(3):
        grow = sel.copy(); grow[E[sel[E[:, 0]], 1]] = True; grow[E[sel[E[:, 1]], 0]] = True; sel = grow
    print('crease vertices', int((concave > crease).sum()), 'relaxed', int(sel.sum()))
    for _ in range(60):
        nbsum = np.zeros_like(Pm); np.add.at(nbsum, E[:, 0], Pm[E[:, 1]]); np.add.at(nbsum, E[:, 1], Pm[E[:, 0]])
        Pm[sel] += 0.5 * (nbsum[sel] / np.maximum(deg[sel], 1) - Pm[sel])
fn = np.cross(Pm[G[:, 1]] - Pm[G[:, 0]], Pm[G[:, 2]] - Pm[G[:, 0]])
Nm = np.zeros((nv, 3)); [np.add.at(Nm, G[:, k], fn) for k in range(3)]
Nm /= np.linalg.norm(Nm, axis=1, keepdims=True) + 1e-12
P = Pm[vid].astype(np.float32); N = Nm[vid].astype(np.float32)

# Write one primitive per colour, sharing the vertex data.
names = [n for n, _ in pal]
lin = lambda h: [float(((c / 255) / 12.92) if c / 255 <= 0.04045 else (((c / 255 + 0.055) / 1.055) ** 2.4)) for c in hexrgb(h)] + [1.0]
blob = bytearray(); views = []; accs = []
def add(arr, target, comp, typ, mm=False):
    o = len(blob); blob.extend(arr.tobytes()); blob.extend(b'\0' * ((4 - len(blob) % 4) % 4))
    views.append({'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes, 'target': target})
    a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0] if arr.ndim > 1 else arr.size), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
ip = add(P, 34962, 5126, 'VEC3', True); inn = add(N, 34962, 5126, 'VEC3')
prims, mats = [], []
for k, n in enumerate(names):
    idx = F[lab == k]
    if not len(idx) or n == 'stroke': continue
    ii = add(idx.astype(np.uint32).ravel(), 34963, 5125, 'SCALAR')
    mats.append({'name': n, 'pbrMetallicRoughness': {'baseColorFactor': lin(OUT[n]), 'metallicFactor': 0, 'roughnessFactor': 1}})
    prims.append({'attributes': {'POSITION': ip, 'NORMAL': inn}, 'indices': ii, 'material': len(mats) - 1})
    print(f'{n:8s} {len(idx):6d} faces')
g = {'asset': {'version': '2.0', 'generator': 'rdts flatpaint'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'model'}],
     'meshes': [{'primitives': prims}], 'materials': mats, 'buffers': [{'byteLength': len(blob)}], 'bufferViews': views, 'accessors': accs}
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
open(dst, 'wb').write(out)
print(dst, len(out), 'bytes')
