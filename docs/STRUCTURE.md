# Estrutura do Projeto GymNight Mobile

## Visão Geral

Este projeto agora está organizado em duas seções principais:

```
GymNight-Mobile/
├── backend/               ← Todo código do backend FastAPI (Python)
│   ├── main.py
│   ├── app/
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── .env
│   └── ...
├── GymNight-Mobile/       ← Documentação e notas do Obsidian
├── docs/                  ← Documentação geral
└── README.md              ← Este arquivo com instruções
```

## 📂 Estrutura do Backend

Todos os arquivos do backend estão organizados na pasta `/backend`:

### Arquivos Principais

- **`main.py`** - Entry point da aplicação FastAPI
- **`requirements.txt`** - Dependências Python (com dev tools)
- **`requirements-prod.txt`** - Dependências apenas de produção
- **`.env`** - Variáveis de ambiente (NÃO commitar!)
- **`.env.example`** - Template das variáveis de ambiente
- **`alembic.ini`** - Configuração do Alembic para migrations

### Pastas

```
backend/
├── app/                   # Código principal da aplicação
│   ├── main.py (MOVIDO PARA backend/)
│   ├── core/              # Configurações e segurança
│   │   ├── config.py
│   │   ├── security.py
│   │   └── ...
│   ├── database/          # ORM e modelos
│   │   ├── connection.py
│   │   └── models.py
│   ├── routers/           # Endpoints (rotas)
│   │   ├── users.py
│   │   ├── health.py
│   │   └── admin.py
│   ├── api/v1/endpoints/  # API versioned endpoints
│   │   └── sync.py
│   ├── middleware/        # Middlewares
│   │   ├── correlation_id.py
│   │   └── access_log.py
│   └── schemas/           # Modelos Pydantic
│       └── user.py
├── alembic/               # Database migrations
│   ├── versions/          # Arquivos de migration
│   ├── env.py
│   └── script.py.mako
└── tests/                 # Testes automatizados
    ├── smoke/             # Testes unitários e smoke
    └── integration/       # Testes com PostgreSQL real
```

## 🚀 Como Rodar

### Desenvolvimento Local

```bash
# 1. Navegue até a pasta backend
cd backend

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Configure o .env
cp .env.example .env
# Edite .env com seus valores reais

# 4. Execute as migrations
alembic upgrade head

# 5. Inicie o servidor
uvicorn main:app --reload
```

A API estará disponível em: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Testes

```bash
# Smoke tests (sem banco real)
cd backend
pytest tests/smoke -v

# Testes de integração (requerem PostgreSQL)
cd backend
pytest tests/integration -v
```

## 🔧 Comandos Importantes

### Alembic (Database Migrations)

```bash
cd backend

# Ver status das migrations
alembic current

# Criar nova migration
alembic revision --autogenerate -m "Descrição da mudança"

# Aplicar todas as migrations pendentes
alembic upgrade head

# Voltar para a migration anterior
alembic downgrade -1
```

### Deploy

```bash
# Com Docker
docker build -t gymnight-backend .
docker run -p 8000:8000 --env-file backend/.env gymnight-backend

# Com Render (já configurado)
# Basta conectar o repositório e preencher as env vars
```

## 📝 Variáveis de Ambiente

As seguintes variáveis devem ser configuradas no arquivo `backend/.env`:

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `SUPABASE_URL` | ✅ | `https://zsqzgzvprgrikqrnzhln.supabase.co` |
| `SUPABASE_JWT_SECRET` | ✅ | Seu JWT Secret do Supabase |
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:port/db` |
| `ADMIN_SECRET` | ✅ | Um valor secreto e seguro |
| `RATE_LIMIT_ENABLED` | ❌ | `true` ou `false` |
| `TOMBSTONE_RETENTION_DAYS` | ❌ | `90` |
| `LOG_LEVEL` | ❌ | `INFO`, `DEBUG`, `WARNING`, `ERROR` |
| `TEST_DATABASE_URL` | ❌ | PostgreSQL para testes (se rodar tests) |

## 📚 Documentação

- **[README.md](./README.md)** - Instruções gerais e visão geral do projeto
- **[backend/tests/](./backend/tests/)** - Exemplos de testes
- **[GymNight-Mobile/](./GymNight-Mobile/)** - Notas e design docs no Obsidian

## ✅ Verificação

Para verificar se tudo está funcionando:

```bash
cd backend
python -c "from app.database.connection import engine; print('✅ Database connection OK')"
python -c "import main; print('✅ Main app import OK')"
pytest tests/smoke -q
```

## 🐛 Troubleshooting

### Erro: `ModuleNotFoundError: No module named 'app'`

Certifique-se de que você está rodando os comandos **dentro da pasta `/backend`**:

```bash
cd backend  # ← Importante!
uvicorn main:app --reload
```

### Erro: `alembic.ini not found`

Se está rodando Alembic, execute dentro da pasta `/backend`:

```bash
cd backend
alembic upgrade head
```

### Erro: `DATABASE_URL not set`

Certifique-se de que o arquivo `backend/.env` existe e tem a variável `DATABASE_URL` preenchida:

```bash
cd backend
cat .env | grep DATABASE_URL
```

## 📦 Estrutura de Deployment

O arquivo `render.yaml` foi atualizado para apontar para o novo local:

```yaml
buildCommand: pip install -r backend/requirements.txt
startCommand: uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

O GitHub Actions workflow (`.github/workflows/integration.yml`) também foi atualizado.

---

**Última atualização:** 2 de julho de 2026
