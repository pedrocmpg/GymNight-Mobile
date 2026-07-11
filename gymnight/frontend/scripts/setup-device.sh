#!/bin/bash

# setup-device.sh — Configurar app para rodar no device físico via USB
# 
# Uso:
#   ./scripts/setup-device.sh <YOUR_PC_IP> <SUPABASE_URL> <SUPABASE_ANON_KEY>
#
# Exemplo:
#   ./scripts/setup-device.sh 192.168.1.100 https://abc123.supabase.co eyJ0eX...

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# VALIDAÇÃO DE ARGUMENTOS
# ============================================================================

if [ $# -lt 1 ]; then
    echo -e "${RED}Erro: Missing arguments${NC}"
    echo ""
    echo "Uso:"
    echo "  $0 <YOUR_PC_IP> [SUPABASE_URL] [SUPABASE_ANON_KEY]"
    echo ""
    echo "Exemplo:"
    echo "  $0 192.168.1.100"
    echo "  $0 192.168.1.100 https://abc123.supabase.co eyJ0eXAi..."
    echo ""
    echo "Para descobrir seu IP local:"
    echo "  hostname -I"
    echo ""
    exit 1
fi

PC_IP="$1"
SUPABASE_URL="${2:-}"
SUPABASE_ANON_KEY="${3:-}"

# ============================================================================
# VALIDAÇÃO DE IP
# ============================================================================

validate_ip() {
    local ip="$1"
    local pattern='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
    
    if ! [[ $ip =~ $pattern ]]; then
        echo -e "${RED}Erro: '$ip' não é um IP válido${NC}"
        exit 1
    fi
    
    # Validação simples dos octetos
    IFS='.' read -ra OCTETS <<< "$ip"
    for octet in "${OCTETS[@]}"; do
        if [ "$octet" -gt 255 ]; then
            echo -e "${RED}Erro: '$ip' não é um IP válido (octeto > 255)${NC}"
            exit 1
        fi
    done
}

validate_ip "$PC_IP"

# ============================================================================
# CRIAR/ATUALIZAR .env
# ============================================================================

ENV_FILE=".env"

echo -e "${YELLOW}Criando/atualizando $ENV_FILE...${NC}"

cat > "$ENV_FILE" << EOF
# Configuração para device via USB (Physical Device)
# Gerado em: $(date)

# Backend URL — ajuste para o IP do seu PC
# EXPO_PUBLIC_* prefixo é obrigatório (Expo exigência)
EXPO_PUBLIC_BACKEND_BASE_URL=http://$PC_IP:8000

# Supabase
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Debug (desabilitar em produção)
EXPO_PUBLIC_DEBUG_SYNC=false
EXPO_PUBLIC_DEBUG_AUTH=false
EXPO_PUBLIC_DEBUG_DB=false
EOF

echo -e "${GREEN}✓ $ENV_FILE criado/atualizado${NC}"

# ============================================================================
# VERIFICAR DEPENDÊNCIAS
# ============================================================================

echo ""
echo -e "${YELLOW}Verificando dependências...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js não instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

# npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm não instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm: $(npm --version)${NC}"

# ADB (se for Android)
if ! command -v adb &> /dev/null; then
    echo -e "${YELLOW}⚠ ADB (Android Debug Bridge) não encontrado${NC}"
    echo "   Instale com: sudo apt-get install android-tools-adb"
    echo "   (necessário para device Android via USB)"
else
    echo -e "${GREEN}✓ ADB: $(adb version 2>&1 | head -1)${NC}"
fi

# Expo CLI
if ! npx expo --version &> /dev/null 2>&1; then
    echo -e "${RED}✗ Expo CLI não disponível${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Expo CLI: $(npx expo --version 2>&1)${NC}"

# ============================================================================
# LISTAR PRÓXIMOS PASSOS
# ============================================================================

echo ""
echo -e "${GREEN}✓ Setup concluído!${NC}"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Conectar o device via USB"
echo "   - Ativar Modo de Desenvolvedor (7 toques em 'Número da build')"
echo "   - Ativar 'Depuração USB' em Configurações → Desenvolvedor"
echo "   - Escolher 'Transferência de arquivos' ao conectar"
echo ""
echo "2. Verificar conexão:"
echo "   $ adb devices"
echo ""
echo "3. Em um terminal, rodar o backend:"
echo "   $ cd gymnight/backend"
echo "   $ uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "4. Em outro terminal, fazer deploy direto no device USB:"
echo "   $ npx expo run:android"
echo "   (Expo detecta device conectado e faz build ~1-2 min)"
echo ""
echo "5. Editar os arquivos em src/ — as mudanças aparecem em tempo real!"
echo ""
echo "Alternativa: usar LAN mode se preferir"
echo "   $ npm start -- --lan"
echo "   (em outro terminal) $ npx expo run:android"
echo ""
echo "Dúvidas? Veja: docs/PHYSICAL_DEVICE_CHECKLIST.md"
