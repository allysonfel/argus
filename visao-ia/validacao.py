"""Roda o pipeline de tracking com várias combinações de parâmetros
contra um vídeo com contagem real conhecida (ground truth), pra achar
a combinação com menor erro, e salva como preset.

Limitação importante, pra não superprometer: "ID switch" de verdade
(métrica formal de MOT, tipo IDF1/MOTA) exige trajetória anotada
quadro a quadro de cada pessoa real, que não temos aqui. O que este
script reporta como "tracks_curtos_fragmentos" é uma aproximação (tracks
com duração abaixo do mínimo configurado) — é um bom proxy de
fragmentação, mas não é uma contagem formal de troca de ID. A métrica
que efetivamente importa pra decidir o preset vencedor é o erro da
CONTAGEM final contra o número real que você informar.

Uso:
    uv run validacao.py --source teste_ground_truth.mp4 --ground-truth 6
    uv run validacao.py --source video_shopping.mp4 --ground-truth 18 --salvar-vencedor
"""

from __future__ import annotations

import argparse
import json
from dataclasses import replace
from pathlib import Path

from config import TrackerConfig
from diagnostico import rodar_diagnostico


def visitantes_estimados(relatorio: dict, min_duracao_s: float) -> int:
    return sum(1 for t in relatorio["duracoes_por_track"] if t["duracao_s"] >= min_duracao_s)


def grade_de_combinacoes(base: TrackerConfig) -> list[TrackerConfig]:
    combos = []
    for lost_s in (1.5, 2.5, 3.5):
        for min_match in (0.7, 0.8, 0.9):
            for min_consec_s in (0.3, 0.5, 1.0):
                combos.append(
                    replace(
                        base,
                        nome=f"grid_lost{lost_s}_match{min_match}_consec{min_consec_s}",
                        lost_track_buffer_s=lost_s,
                        minimum_matching_threshold=min_match,
                        minimum_consecutive_frames_s=min_consec_s,
                    )
                )
    return combos


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--ground-truth", type=int, required=True, help="contagem real de pessoas no vídeo")
    parser.add_argument("--min-duracao-s", type=float, default=1.5, help="regra de contagem: duração mínima do track")
    parser.add_argument("--incluir-botsort", action="store_true", help="também testa botsort_reid (mais lento)")
    parser.add_argument("--salvar-vencedor", action="store_true", help="salva a melhor combinação como preset 'default'")
    parser.add_argument("--saida", default="validacao_resultado.json")
    args = parser.parse_args()

    base = TrackerConfig.carregar("default")
    combos = grade_de_combinacoes(base)
    if args.incluir_botsort:
        botsort_base = TrackerConfig.carregar("botsort_reid")
        combos.append(replace(botsort_base, nome="botsort_reid_padrao"))

    print(f"Testando {len(combos)} combinações contra ground truth = {args.ground_truth}...\n")
    resultados = []
    for i, cfg in enumerate(combos, 1):
        relatorio = rodar_diagnostico(args.source, cfg, out_path=None)
        estimado = visitantes_estimados(relatorio, args.min_duracao_s)
        erro_abs = abs(estimado - args.ground_truth)
        erro_pct = round(100 * erro_abs / args.ground_truth, 1) if args.ground_truth else None
        fragmentos = relatorio["tracks_com_menos_de_2s"]

        resultado = {
            "combo": cfg.nome,
            "tracker_tipo": cfg.tracker_tipo,
            "params": {
                "lost_track_buffer_s": cfg.lost_track_buffer_s,
                "minimum_matching_threshold": cfg.minimum_matching_threshold,
                "minimum_consecutive_frames_s": cfg.minimum_consecutive_frames_s,
                "track_activation_threshold": cfg.track_activation_threshold,
                "det_conf_threshold": cfg.det_conf_threshold,
            },
            "total_ids_criados": relatorio["total_ids_criados"],
            "tracks_fragmentos_menos_2s": fragmentos,
            "visitantes_unicos_estimado": estimado,
            "ground_truth": args.ground_truth,
            "erro_absoluto": erro_abs,
            "erro_percentual": erro_pct,
        }
        resultados.append(resultado)
        print(
            f"[{i}/{len(combos)}] {cfg.nome:45s} -> estimado={estimado:3d}  erro={erro_abs:2d} "
            f"({erro_pct}%)  ids_totais={relatorio['total_ids_criados']:3d}  fragmentos={fragmentos}"
        )

    resultados.sort(key=lambda r: (r["erro_absoluto"], r["tracks_fragmentos_menos_2s"]))
    vencedor = resultados[0]

    print("\n=== MELHOR COMBINAÇÃO ===")
    print(json.dumps(vencedor, indent=2, ensure_ascii=False))

    Path(args.saida).write_text(json.dumps(resultados, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nResultado completo (todas as combinações) salvo em {args.saida}")

    if args.salvar_vencedor:
        cfg_vencedora = next(c for c in combos if c.nome == vencedor["combo"])
        cfg_vencedora.nome = "default"
        caminho = cfg_vencedora.salvar()
        print(f"\nPreset vencedor salvo como padrão em {caminho}")


if __name__ == "__main__":
    main()
