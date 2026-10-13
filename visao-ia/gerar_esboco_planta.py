"""Extrai corredores, lojas e contorno das plantas oficiais (pela cor) e
grava em coordenadas da planta do sistema (1000 x 560)."""
import cv2, json, numpy as np, sys
D = sys.argv[1]; SAIDA = sys.argv[2]

def poligonos(mask, area_min, eps, transf, buracos=True):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    res = []
    if hier is None: return res
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1: continue  # só externos (buracos tratados abaixo)
        if cv2.contourArea(c) < area_min: continue
        anel = [cv2.approxPolyDP(c, eps, True)]
        filho = hier[0][i][2] if buracos else -1
        while filho != -1:
            if cv2.contourArea(cs[filho]) > area_min / 2: anel.append(cv2.approxPolyDP(cs[filho], eps, True))
            filho = hier[0][filho][0]
        res.append([[[round(transf(p[0][0], p[0][1])[0], 1), round(transf(p[0][0], p[0][1])[1], 1)] for p in a] for a in anel])
    return res

saida = {}
# ---------- Térreo ----------
im = cv2.imread(f'{D}/p2.jpg'); hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
v = hsv[..., 2].astype(int); s = hsv[..., 1].astype(int)
H, W = v.shape
predio = np.zeros((H, W), np.uint8)
cv2.fillPoly(predio, [np.array([[250, 0], [930, 0], [930, 280], [1400, 280], [1400, 800], [740, 800], [740, 770], [520, 770], [250, 560]])], 255)
corr = ((v >= 236) & (s <= 40)).astype(np.uint8) * 255
corr = cv2.morphologyEx(corr, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)); corr = cv2.morphologyEx(corr, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
corr &= predio
corr[:, 1292:] = 0  # poltronas do cinema (Centerplex)
loja = ((v >= 196) & (v < 236) & (s <= 22)).astype(np.uint8) * 255
loja = cv2.morphologyEx(loja, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) & predio
T = lambda x, y: (48 + x * 0.56, y * 0.56)
contorno_t = cv2.morphologyEx(cv2.bitwise_or(corr, loja), cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
saida['T'] = {
    'corredores': poligonos(corr, 600, 2.0, T),
    'lojas': poligonos(loja, 250, 1.5, T, buracos=False),
    'contorno': poligonos(contorno_t, 20000, 3, T),
}
# ---------- Piso 1 ----------
im = cv2.imread(f'{D}/p3.jpg')[0:690]; g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(int)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
H, W = g.shape
branco = (g >= 240).astype(np.uint8) * 255
loja = ((g >= 195) & (g < 238) & (hsv[..., 1] <= 30)).astype(np.uint8) * 255
loja = cv2.morphologyEx(loja, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# corredores = áreas brancas que NÃO tocam a borda da imagem (fora do prédio é branco também)
n, lab, stats, _ = cv2.connectedComponentsWithStats(branco, 4)
corr = np.zeros_like(branco)
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if x == 0 or y == 0 or x + w >= W or y + h >= H or a < 800: continue
    corr[lab == i] = 255
corr = cv2.morphologyEx(corr, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
P = lambda x, y: (13 + x * 560 / 690, y * 560 / 690)
contorno_p = cv2.morphologyEx(cv2.bitwise_or(corr, loja), cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
# estacionamento E-50: área aberta abaixo do GO! Park (recorte geométrico)
zona_estac = np.zeros_like(corr)
cv2.fillPoly(zona_estac, [np.array([[745, 470], [1180, 175], [1200, 175], [1200, 360], [820, 610], [770, 540]])], 255)
estac = cv2.bitwise_and(corr, zona_estac)
corr = cv2.bitwise_and(corr, cv2.bitwise_not(zona_estac))
# corredor: só o maior componente (tira faixas de fachada e sobras)
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(corr, 4)
if n2 > 1:
    maior = 1 + int(np.argmax(st2[1:, 4]))
    corr = np.where(lab2 == maior, 255, 0).astype(np.uint8)
saida['P1'] = {
    'corredores': poligonos(corr, 800, 2.0, P),
    'estacionamento': poligonos(estac, 5000, 3, P),
    'lojas': poligonos(loja, 300, 1.5, P, buracos=False),
    'contorno': poligonos(contorno_p, 20000, 3, P),
}
json.dump(saida, open(SAIDA, 'w'), separators=(',', ':'))
for a in saida: print(a, {k: len(v) for k, v in saida[a].items()})
# visualização
for a, (w, h) in (('T', (1000, 560)), ('P1', (1000, 560))):
    vis = np.full((h, w, 3), 245, np.uint8)
    for p in saida[a]['contorno']: cv2.fillPoly(vis, [np.array(r, np.int32) for r in p], (225, 225, 225))
    for p in saida[a]['lojas']: cv2.fillPoly(vis, [np.array(r, np.int32) for r in p], (205, 205, 205)); cv2.polylines(vis, [np.array(p[0], np.int32)], True, (150, 150, 150), 1)
    for p in saida[a]['corredores']: cv2.fillPoly(vis, [np.array(r, np.int32) for r in p], (250, 225, 190))
    for p in saida[a].get('estacionamento', []): cv2.fillPoly(vis, [np.array(r, np.int32) for r in p], (180, 200, 210))
    cv2.imwrite(f'{D}/esboco-{a}.png', vis)
