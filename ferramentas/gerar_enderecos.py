"""Gera dados/enderecos-itabira.json a partir do CNEFE (Censo 2022, IBGE).

Os arquivos vêm da padronização do CNEFE feita pelo IPEA para o pacote geocodebr
(https://github.com/ipeaGIT/padronizacao_cnefe). O painel usa o JSON gerado para
localizar endereços digitados nas fichas sem depender de serviço externo.

Uso:
    pip install duckdb
    python ferramentas/gerar_enderecos.py [pasta_com_os_parquet]

Sem a pasta, o script baixa os três arquivos (cerca de 520 MB) para uma pasta temporária.
"""
import json
import os
import sys
import tempfile
import urllib.request

import duckdb

RELEASE = "v0.5.0"
URL = "https://github.com/ipeaGIT/padronizacao_cnefe/releases/download/{rel}/{arq}.parquet"
ARQUIVOS = ["municipio_localidade", "municipio_logradouro_localidade", "municipio_logradouro_numero_localidade"]
CODIGO_IBGE = 3131703  # Itabira (MG)
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "enderecos-itabira.json")


def baixar(pasta):
    for arq in ARQUIVOS:
        destino = os.path.join(pasta, arq + ".parquet")
        if not os.path.exists(destino):
            print("baixando", arq)
            urllib.request.urlretrieve(URL.format(rel=RELEASE, arq=arq), destino)


def e5(v):
    """Coordenada em inteiro (1e-5 grau, cerca de 1 m)."""
    return round(v * 100000)


def main():
    pasta = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="cnefe_")
    baixar(pasta)
    p = {a: os.path.join(pasta, a + ".parquet") for a in ARQUIVOS}
    con = duckdb.connect()

    bairros = con.sql(f"""
        SELECT localidade, lat, lon FROM '{p['municipio_localidade']}'
        WHERE code_muni = {CODIGO_IBGE} ORDER BY localidade""").fetchall()
    indice_bairro = {b[0]: i for i, b in enumerate(bairros)}

    ruas = con.sql(f"""
        SELECT logradouro, localidade, lat, lon FROM '{p['municipio_logradouro_localidade']}'
        WHERE code_muni = {CODIGO_IBGE} ORDER BY logradouro, localidade""").fetchall()

    numeros = {}
    for logr, loc, num, lat, lon in con.sql(f"""
            SELECT logradouro, localidade, numero, lat, lon FROM '{p['municipio_logradouro_numero_localidade']}'
            WHERE code_muni = {CODIGO_IBGE} AND numero IS NOT NULL AND numero > 0
            ORDER BY logradouro, localidade, numero""").fetchall():
        numeros.setdefault((logr, loc), []).append((num, lat, lon))

    saida_ruas = []
    for logr, loc, lat, lon in ruas:
        if loc not in indice_bairro:
            continue
        clat, clon = e5(lat), e5(lon)
        plano = []
        # Números da rua no bairro: [número, Δlat, Δlng, ...] relativos ao centro da rua
        for num, nlat, nlon in numeros.get((logr, loc), []):
            plano += [num, e5(nlat) - clat, e5(nlon) - clon]
        saida_ruas.append([logr, indice_bairro[loc], clat, clon, plano])

    dados = {
        "fonte": f"IBGE, CNEFE do Censo 2022 (padronização IPEA, geocodebr {RELEASE})",
        "municipio": "ITABIRA - MG",
        "escala": 100000,
        "bairros": [[b, e5(lat), e5(lon)] for b, lat, lon in bairros],
        "ruas": saida_ruas,
    }
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(bairros)} bairros, {len(saida_ruas)} ruas, "
          f"{sum(len(v) for v in numeros.values())} números -> {os.path.getsize(SAIDA) // 1024} KB")


if __name__ == "__main__":
    main()
