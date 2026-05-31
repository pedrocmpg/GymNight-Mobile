# ============================================================================
# CONFIGURAÇÕES CENTRALIZADAS DA APLICAÇÃO
# ============================================================================
# Este módulo centraliza todas as variáveis de configuração sensíveis usando
# variáveis de ambiente carregadas do arquivo .env via python-dotenv.
#
# VANTAGENS:
# - Segurança: Segredos não ficam hardcoded no código
# - Flexibilidade: Fácil trocar entre ambientes (dev, staging, prod)
# - Git-safe: Arquivo .env fica no .gitignore (não sobe pro GitHub)
# ============================================================================

import os
from dotenv import load_dotenv

# ============================================================================
# CARREGAMENTO DO ARQUIVO .env
# ============================================================================
# load_dotenv() busca o arquivo .env na raiz do projeto e carrega todas as
# variáveis de ambiente definidas nele para o processo Python.
#
# FUNCIONAMENTO:
# 1. Procura arquivo .env na raiz do projeto
# 2. Lê cada linha no formato: VARIAVEL=valor
# 3. Injeta as variáveis no os.environ (dicionário de ambiente do Python)
# 4. Agora podemos acessar via os.getenv("VARIAVEL")
#
# IMPORTANTE:
# - O arquivo .env NUNCA deve ser commitado no Git (adicionar no .gitignore)
# - Cada desenvolvedor tem seu próprio .env local
# - Em produção, usar variáveis de ambiente do servidor (não arquivo .env)
# ============================================================================
load_dotenv()

# ============================================================================
# CONFIGURAÇÕES DE AUTENTICAÇÃO JWT
# ============================================================================

# SECRET_KEY: Chave secreta usada para assinar os tokens JWT
# ------------------------------------------------------------
# CARREGAMENTO SEGURO:
# - os.getenv("SECRET_KEY") busca a variável SECRET_KEY do arquivo .env
# - Se não encontrar, usa valor padrão (apenas para desenvolvimento)
# - Em produção, SEMPRE definir SECRET_KEY no .env ou variáveis de ambiente
#
# SEGURANÇA CRÍTICA:
# - Esta chave assina TODOS os tokens JWT
# - Se vazada, atacante pode gerar tokens falsos
# - NUNCA commitar no Git
# - Gerar com: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY = os.getenv("SECRET_KEY", "chave_padrao_apenas_para_desenvolvimento_TROCAR_EM_PRODUCAO")

# ALGORITHM: Algoritmo de assinatura do JWT (HS256 = HMAC-SHA256)
# ----------------------------------------------------------------
# - Simétrico, rápido, seguro
# - Padrão da indústria (Google, Facebook, GitHub)
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# ACCESS_TOKEN_EXPIRE_MINUTES: Tempo de vida do token em minutos
# ---------------------------------------------------------------
# - Curto (5-15 min): Mais seguro, pior UX
# - Médio (30-60 min): Equilíbrio
# - Longo (7-30 dias): Melhor UX, menos seguro
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# ============================================================================
# CONFIGURAÇÕES DE BANCO DE DADOS
# ============================================================================

# DATABASE_URL: String de conexão com PostgreSQL
# -----------------------------------------------
# Formato: postgresql://usuario:senha@host:porta/nome_banco
#
# SEGURANÇA:
# - Senha vem do .env (não fica hardcoded)
# - Em produção, usar serviços gerenciados (AWS RDS, Google Cloud SQL)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:gymnight_senha_123@localhost:5432/gymnight_db")
