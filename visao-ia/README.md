# Argus Visão — motor de visão computacional

Detecta pessoas (RF-DETR), rastreia (ByteTrack, supervision), conta
passagens por linha e ocupação por zona, e entrega tudo ao vivo para a
tela **Câmeras ao vivo** do painel (`/shopping/ao-vivo`).

## Rodando

```bash
uv sync
uv run preparar_demo.py                     # baixa e prepara os vídeos de demonstração
ARGUS_PAINEL_ORIGENS="http://localhost:3000" \
  uv run uvicorn argus_visao.api:app --port 8500
```

`ARGUS_PAINEL_ORIGENS` precisa conter a origem do painel (CORS). O
painel encontra o motor por `NEXT_PUBLIC_ARGUS_VISAO_URL` (padrão
`http://localhost:8500`).

> **Windows com acento no caminho** (ex.: `C:\Users\André`): o Python
> 3.11 lê errado o `.pth` da instalação editável e o import
> `argus_visao` falha. Rode com `PYTHONPATH=src`:
> `PYTHONPATH=src .venv/Scripts/python.exe -m uvicorn argus_visao.api:app --port 8500`

## Câmeras de demonstração

Enquanto as câmeras do Shopping Caruaru não estão conectadas,
`config/cameras.json` traz 15 câmeras `demo-*` com vídeos reais de
shopping, distribuídas pelos pisos e corredores da planta do painel
(`T` Térreo, `P1` Piso 1), cada uma com linhas de contagem e zonas:

| Câmera | Origem |
|---|---|
| CAM 01 · Praça Central (vista superior) | Pexels 3660928 |
| CAM 02 · Corredor Principal Leste | Pexels 34892172 |
| CAM 03 · Ala Norte (CCTV) | CAVIAR WalkByShop1cor |
| CAM 04 · Ala Norte · fachada de loja (CCTV) | CAVIAR WalkByShop1front |
| CAM 05 · Átrio de eventos | Pexels 15007112 |
| CAM 06 · Escadas rolantes centrais | Pexels 1338592 |
| CAM 07 · Hipermercado · caixas | Pexels 39221979 |
| CAM 08 · Hipermercado · autoatendimento | Pexels 36635591 |
| CAM 09 · Mezanino | Pexels 36108267 (recorte 16:9 de vídeo vertical) |
| CAM 10 · Átrio visto do Piso 1 | Pexels 39527934 |
| CAM 11 · Praça de Alimentação · balcões | Pexels 36694215 |
| CAM 12 · Praça de Alimentação · quiosques | Pexels 28925811 |
| CAM 13 · Praça de Alimentação · fila do fast food | Pexels 1338597 |
| CAM 14 · Corredor gastronômico | Pexels 39687034 |
| CAM 15 · Área de shows | Pexels 34697769 |

Pexels: uso livre, inclusive comercial. CAVIAR: câmeras de segurança
reais de um shopping em Lisboa, sincronizadas (CAM 03 e 04 são a mesma
cena em dois ângulos), Creative Commons BY-SA; material publicado com
elas deve citar o projeto EC CAVIAR (IST 2001 37540). Cada câmera mostra
a origem no painel (campo `credito`).

`preparar_demo.py` baixa os vídeos, reduz para até 960 px e 30 fps,
recorta vídeos verticais e estabiliza os que foram filmados com deriva
de câmera, para linhas e zonas ficarem fixas no piso. Saída em
`uploads/demo/` (fora do git). Os vídeos se repetem em loop e as
contagens seguem acumulando a cada volta.

Para trocar por câmeras reais, basta pôr o RTSP em `fonte` e redesenhar
linhas e zonas (coordenadas 0-1 sobre a imagem).

## Rastreio: IDs estáveis e caminhos

Três camadas, medidas contra o gabarito do CAVIAR (ID real de cada
pessoa) e o vídeo sintético, a 3 fps de análise:

1. **Rastreador OC-SORT** (pacote `trackers`, da Roboflow; o ByteTrack do
   supervision está obsoleto e continua disponível com
   `"rastreador": "bytetrack"` no preset). Corrige a trajetória quando a
   pessoa reaparece e usa a direção do movimento, o que reduz troca de ID
   em oclusões e cruzamentos. `lost_track_buffer_s` = 1 s: esperas
   maiores fazem o OC-SORT juntar pessoas diferentes (a costura abaixo
   cobre os sumiços longos).
2. **Costura de IDs** (`regras.py`): um ID novo herda o de uma pessoa
   perdida há até 4 s se aparecer onde ela estaria (posição +
   velocidade), com altura e aparência compatíveis.
3. **Re-ID por aparência** (`reid.py`, OSNet em ONNX, só na câmera aberta
   no painel): galeria de aparência de cada pessoa tirada com ela
   sozinha na imagem; usada na costura e para desfazer troca de IDs
   depois que duas pessoas se cruzam. Nos recortes do CAVIAR, separa
   mesma pessoa x pessoas diferentes melhor que o histograma de cor
   (AUC 0,91 x 0,85). Custo: ~50 ms por chamada em CPU, ~1-2 chamadas/s.

| Configuração | Corredor (17 reais) | IDs por pessoa | Fachada | Sintético (6) |
|---|---|---|---|---|
| ByteTrack, sem costura | 22 | 2,53 | 5 | 6 |
| ByteTrack + costura | 20 | 2,35 | 4 | 6 |
| OC-SORT + costura (+ Re-ID) | 17 | 2,00 | 4 | 6 |

No CAVIAR o Re-ID conferiu os 14 cruzamentos e confirmou os IDs do
OC-SORT (nenhuma troca indevida); o erro que sobra é de pessoas paradas
juntas com as caixas sobrepostas por muito tempo. Mais resolução, mais
fps (GPU) e câmeras mais altas são o que reduz isso daqui pra frente.

**Licença do Re-ID:** os pesos do OSNet são MIT, mas foram treinados em
base acadêmica (Market-1501) com termos de uso de pesquisa. Serve para
demonstração e avaliação; antes de produção comercial, validar com o
jurídico ou treinar com dados próprios. Para desligar:
`"reid": "histograma"` em `config/motor.json`. O modelo é baixado
sozinho na primeira execução para `models/osnet/` (fora do git).

Cada pessoa leva no WebSocket o caminho (`p`, pés em 0-1) desde que
entrou na imagem; o painel desenha o caminho atual e o de quem passou nos
últimos 2 minutos.

## Desempenho em CPU

Sem GPU, cada inferência do `rfdetr-nano` leva ~150 ms e o modelo é
compartilhado entre as câmeras. `fps_analise_sem_espectador` em
`config/motor.json` limita as câmeras que ninguém está assistindo
(0,3 fps na demonstração com 15 câmeras), e a câmera aberta no painel roda no `fps_analise`
cheio e fura a fila do detector compartilhado (sem isso, as câmeras de
fundo a empurravam para ~1 fps). Com GPU, remova esse limite (`null`). O mosaico do painel usa
`pessoas_detectadas` (detecções da última análise), que não depende do
rastreio e por isso vale mesmo nessas câmeras mais lentas.

## Endpoints

Ver o docstring de `src/argus_visao/api.py`.
