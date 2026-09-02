# ============================================================================
# GymNight Backend — FastAPI
# ============================================================================
# Imagem usada tanto para rodar o backend localmente quanto para a suíte de
# testes (ver docker-compose.yml na raiz do repositório).
#
# Requisitos 12.6 e 14.1: a imagem precisa expor um HEALTHCHECK que chame
# GET /health — o `tests/smoke/test_dockerfile.py` verifica isso.
# ============================================================================

FROM python:3.12-slim

# Não gerar .pyc e não bufferizar stdout — em container, log bufferizado é log
# que se perde quando o processo morre.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# curl é usado pelo HEALTHCHECK abaixo. psycopg2-binary já traz os binários do
# Postgres, então não é preciso libpq-dev nem build-essential aqui.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Camada de dependências separada do código: mudar um arquivo .py não invalida
# o cache do pip install, que é a parte cara do build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Req 12.6: timeout 5s, intervalo 30s, start period 10s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
