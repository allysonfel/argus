"""Avaliação da contagem: compara o sistema com a contagem REAL que você
fez à mão e testa combinações de parâmetros do tracker.

1. Coloque os vídeos em visao-ia/videos/
2. Informe a contagem real de cada um em videos/contagens.json:

    {
      "videos": [
        {"arquivo": "corredor-pexels-1.mp4", "pessoas_reais": 18},
        {"arquivo": "entrada-pixabay.mp4", "pessoas_reais": 25,
         "linha": {"inicio": [0.0, 0.6], "fim": [1.0, 0.6]}, "entradas_reais": 12}
      ]
    }

   - pessoas_reais: quantas pessoas DIFERENTES aparecem no vídeo
     (compara com "visitantes únicos (estimativa)").
   - linha + entradas_reais (opcional): quantas cruzam a linha no
     sentido de entrada (compara com a contagem por linha).

3. Rode:
    uv run avaliar.py                       # avalia o preset atual em todos os vídeos
    uv run avaliar.py --grade               # testa a grade de parâmetros
    uv run avaliar.py --grade --salvar-vencedor
    uv run avaliar.py --video videos/x.mp4 --real 18   # um vídeo avulso

A primeira rodada de cada vídeo detecta tudo (demora); as seguintes usam
cache e saem em segundos.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import replace
from itertools import product
from pathlib import Path

from argus_visao.config import RAIZ, Linha, TrackerConfig
from argus_visao.offline import detectar_video, rodar

CONTAGENS = RAIZ / "videos" / "contagens.json"

GRADE = {
    "lost_track_buffer_s": [1.5, 2.5, 3.5],
    "minimum_matching_threshold": [0.8, 0.9, 0.95],
    "minimum_consecutive_frames_s": [0.25, 0.5, 1.0],
    "min_track_duration_s": [1.0, 1.5, 2.5],
    "det_conf_threshold": [0.35, 0.5],
}


def carregar_casos(args) -> list[dict]:
    if args.video:
        if args.real is None:
            raise SystemExit("informe --real N junto com --video")
        return [{"arquivo": str(args.video), "pessoas_reais": args.real}]
    if not CONTAGENS.exists():
        raise SystemExit(f"crie {CONTAGENS.relative_to(RAIZ)} (veja o exemplo no topo deste arquivo)")
    casos = json.loads(CONTAGENS.read_text(encoding="utf-8"))["videos"]
    for c in casos:
        caminho = Path(c["arquivo"])
        c["arquivo"] = str(caminho if caminho.is_absolute() or caminho.exists() else RAIZ / "videos" / caminho)
    return casos


def avaliar(cfg: TrackerConfig, casos: list[dict], deteccoes: dict, fps: float) -> dict:
    linhas_resultado = []
    erros_pct = []
    for c in casos:
        quadros, tamanho = deteccoes[c["arquivo"]]
        linhas = [Linha(id="avaliacao", nome="avaliação", inicio=tuple(c["linha"]["inicio"]), fim=tuple(c["linha"]["fim"]))] if c.get("linha") else []
        r = rodar(quadros, tamanho, cfg, fps, linhas=linhas)
        item = {"video": Path(c["arquivo"]).name, "real": c["pessoas_reais"], "sistema": r["visitantes_unicos_estimado"], "ids": r["ids_criados"]}
        item["erro_pct"] = round(100 * abs(item["sistema"] - item["real"]) / max(1, item["real"]), 1)
        erros_pct.append(item["erro_pct"])
        if c.get("entradas_reais") is not None and r["linhas"]:
            item["entradas_real"] = c["entradas_reais"]
            item["entradas_sistema"] = r["linhas"][0]["entradas"]
            erro_linha = round(100 * abs(item["entradas_sistema"] - item["entradas_real"]) / max(1, item["entradas_real"]), 1)
            item["entradas_erro_pct"] = erro_linha
            erros_pct.append(erro_linha)
        linhas_resultado.append(item)
    return {"erro_medio_pct": round(sum(erros_pct) / len(erros_pct), 1), "videos": linhas_resultado}


def imprimir(titulo: str, res: dict) -> None:
    print(f"\n{titulo}  ->  erro médio {res['erro_medio_pct']}%")
    for v in res["videos"]:
        extra = f" | entradas: real {v['entradas_real']}, sistema {v['entradas_sistema']} ({v['entradas_erro_pct']}%)" if "entradas_real" in v else ""
        print(f"  {v['video']:<40} real {v['real']:>4} | sistema {v['sistema']:>4} ({v['erro_pct']}%) | IDs criados {v['ids']}{extra}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--preset", default="default")
    p.add_argument("--fps", type=float, default=4.0)
    p.add_argument("--grade", action="store_true", help="testa combinações de parâmetros")
    p.add_argument("--salvar-vencedor", action="store_true", help="salva a melhor combinação como preset 'default'")
    p.add_argument("--video", type=Path)
    p.add_argument("--real", type=int)
    args = p.parse_args()

    casos = carregar_casos(args)
    deteccoes = {c["arquivo"]: detectar_video(Path(c["arquivo"]), args.fps) for c in casos}
    base = TrackerConfig.carregar(args.preset)

    atual = avaliar(base, casos, deteccoes, args.fps)
    imprimir(f"Preset atual '{base.nome}'", atual)
    if not args.grade:
        return

    nomes = list(GRADE)
    resultados = []
    for valores in product(*GRADE.values()):
        cfg = replace(base, nome="grade", **dict(zip(nomes, valores)))
        resultados.append((avaliar(cfg, casos, deteccoes, args.fps)["erro_medio_pct"], cfg))
    resultados.sort(key=lambda r: r[0])

    print(f"\nTop 5 de {len(resultados)} combinações:")
    for erro, cfg in resultados[:5]:
        print(f"  erro {erro:>5}% | " + ", ".join(f"{n}={getattr(cfg, n)}" for n in nomes))

    melhor_erro, melhor = resultados[0]
    imprimir("Melhor combinação", avaliar(melhor, casos, deteccoes, args.fps))
    if args.salvar_vencedor:
        if melhor_erro < atual["erro_medio_pct"]:
            caminho = replace(melhor, nome="default").salvar()
            print(f"\nSalvo em {caminho.relative_to(RAIZ)} (era {atual['erro_medio_pct']}%, agora {melhor_erro}%). Reinicie o motor pra aplicar.")
        else:
            print("\nO preset atual já é o melhor; nada salvo.")


if __name__ == "__main__":
    main()
