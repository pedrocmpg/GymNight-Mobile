# ============================================================================
# MÓDULO DE SEGURANÇA - FUNÇÕES CRIPTOGRÁFICAS
# ============================================================================
# Este módulo centraliza todas as operações de segurança relacionadas a:
# - Hashing de senhas com bcrypt
# - Verificação de senhas
# - Geração de tokens JWT
#
# PRINCÍPIO: Single Responsibility - Um módulo, uma responsabilidade (segurança)
# ============================================================================

import bcrypt
import jwt
from datetime import datetime, timedelta
from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES


def hash_password(password: str) -> str:
    """
    Gera um hash seguro da senha usando bcrypt puro.
    
    PASSO A PASSO DO PROCESSO DE CRIPTOGRAFIA:
    -------------------------------------------
    1. CONVERSÃO PARA BYTES:
       - O bcrypt trabalha exclusivamente com bytes, não strings
       - Convertemos a senha string para bytes usando UTF-8 encoding
       - Exemplo: "MinhaSenh@123" -> b'MinhaSenh@123'
    
    2. GERAÇÃO DO SALT:
       - O bcrypt.gensalt() cria um salt aleatório único para cada senha
       - O salt é um valor randômico que impede ataques de rainbow table
       - Cada usuário terá um salt diferente, mesmo com senhas iguais
       - O salt fica embutido no hash final (não precisa armazenar separado)
    
    3. APLICAÇÃO DO HASH:
       - bcrypt.hashpw() combina a senha + salt e aplica o algoritmo bcrypt
       - O resultado é um hash de 60 caracteres em formato bytes
       - Exemplo: b'$2b$12$...' (contém versão, custo, salt e hash)
    
    4. CONVERSÃO PARA STRING:
       - O banco de dados espera uma string, não bytes
       - Decodificamos o hash de bytes para string UTF-8
       - Essa string é o que será armazenado no campo senha_hash
    
    ESTRUTURA DO HASH BCRYPT:
    -------------------------
    $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqgdqJ4K6
    │  │  │                      │
    │  │  │                      └─ Hash (31 caracteres)
    │  │  └─ Salt (22 caracteres)
    │  └─ Custo (12 = 2^12 = 4096 iterações)
    └─ Versão do bcrypt (2b = mais recente)
    
    POR QUE BCRYPT É SEGURO?
    ------------------------
    - SALT ÚNICO: Cada usuário tem um salt diferente (impede rainbow tables)
    - CUSTO ADAPTATIVO: Algoritmo é intencionalmente lento (dificulta força bruta)
    - BATTLE-TESTED: Usado há décadas em sistemas críticos (bancos, governos)
    - RESISTENTE A GPU: Difícil de paralelizar (protege contra ataques massivos)
    
    Args:
        password (str): A senha em texto plano fornecida pelo usuário
    
    Returns:
        str: O hash bcrypt pronto para ser armazenado no banco de dados
             Exemplo: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/..."
    
    Nota de Segurança:
        - Este método usa bcrypt puro (sem passlib)
        - O bcrypt tem limite de 72 bytes, mas isso é suficiente para senhas normais
        - Senhas maiores são truncadas automaticamente pelo bcrypt
    """
    # PASSO 1: Converter senha string para bytes (exigência do bcrypt)
    # UTF-8 garante suporte a caracteres especiais (acentos, símbolos, emojis)
    password_bytes = password.encode('utf-8')
    
    # PASSO 2: Gerar salt aleatório de segurança
    # O salt é único para cada senha, mesmo que duas pessoas usem "123456"
    # Isso impede ataques de rainbow table (tabelas pré-computadas de hashes)
    salt = bcrypt.gensalt()
    
    # PASSO 3: Aplicar o hash combinando senha + salt
    # bcrypt.hashpw() aplica o algoritmo bcrypt com o custo padrão (12 rounds)
    # Quanto maior o custo, mais lento (e mais seguro), mas mais CPU consome
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    
    # PASSO 4: Converter o hash de bytes para string UTF-8 para salvar no banco
    # O PostgreSQL armazena strings, não bytes, então precisamos decodificar
    hashed_string = hashed_bytes.decode('utf-8')
    
    return hashed_string


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se a senha fornecida no login corresponde ao hash armazenado no banco.
    
    FUNCIONAMENTO DETALHADO:
    ------------------------
    Esta função usa bcrypt para comparar de forma segura a senha digitada pelo
    usuário com o hash que foi salvo no banco de dados durante o cadastro.
    
    PASSO A PASSO DA VERIFICAÇÃO:
    ------------------------------
    1. CONVERSÃO DA SENHA FORNECIDA PARA BYTES:
       - O usuário digita a senha no app móvel (ex: "MinhaSenh@123")
       - A senha chega aqui como string Python
       - bcrypt.checkpw() EXIGE que ambos os parâmetros sejam bytes, não strings
       - Usamos .encode('utf-8') para converter string → bytes
       - Exemplo: "MinhaSenh@123" → b'MinhaSenh@123'
       
       POR QUE UTF-8?
       - Suporta caracteres especiais (acentos, emojis, símbolos)
       - Padrão universal (funciona em qualquer idioma)
       - Mesmo encoding usado no cadastro (garante consistência)
    
    2. CONVERSÃO DO HASH ARMAZENADO PARA BYTES:
       - O hash foi salvo no banco como string (campo senha_hash)
       - Exemplo de hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqgdqJ4K6"
       - bcrypt.checkpw() também exige que o hash seja bytes
       - Usamos .encode('utf-8') novamente para converter
       - Exemplo: "$2b$12$..." → b'$2b$12$...'
    
    3. COMPARAÇÃO CRIPTOGRÁFICA COM BCRYPT:
       - bcrypt.checkpw(senha_bytes, hash_bytes) faz o seguinte:
       
       a) EXTRAÇÃO DO SALT:
          - O hash armazenado contém o salt embutido (primeiros 29 caracteres)
          - Exemplo de hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCO...
          - Estrutura: $versão$custo$salt (22 chars)$hash (31 chars)
          - bcrypt extrai: salt = "LQv3c1yqBWVHxkd0LHAkCO"
       
       b) REHASHING DA SENHA FORNECIDA:
          - Aplica o mesmo algoritmo bcrypt na senha fornecida
          - Usa o MESMO salt extraído do hash armazenado
          - Gera um novo hash temporário
          - Exemplo: bcrypt("MinhaSenh@123", salt) → hash_temporario
       
       c) COMPARAÇÃO BYTE A BYTE:
          - Compara hash_temporario com hash_armazenado
          - Se TODOS os bytes forem idênticos → senha correta → retorna True
          - Se QUALQUER byte for diferente → senha errada → retorna False
          - Comparação é resistente a timing attacks (tempo constante)
    
    4. RETORNO DO RESULTADO:
       - True: Senha fornecida corresponde ao hash (login permitido)
       - False: Senha fornecida NÃO corresponde ao hash (login negado)
    
    POR QUE BCRYPT É SEGURO?
    ------------------------
    - SALT ÚNICO: Cada usuário tem um salt diferente (impede rainbow tables)
    - CUSTO ADAPTATIVO: Algoritmo é intencionalmente lento (dificulta força bruta)
    - TIMING ATTACK RESISTANT: Comparação em tempo constante (não vaza informações)
    - BATTLE-TESTED: Usado há décadas em sistemas críticos (bancos, governos)
    
    EXEMPLO PRÁTICO:
    ----------------
    Cadastro (função hash_password):
    - Usuário cria senha: "MinhaSenh@123"
    - bcrypt gera salt: "LQv3c1yqBWVHxkd0LHAkCO"
    - bcrypt gera hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqgdqJ4K6"
    - Hash é salvo no banco no campo senha_hash
    
    Login (esta função):
    - Usuário digita senha: "MinhaSenh@123"
    - Buscamos hash do banco: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqgdqJ4K6"
    - bcrypt extrai salt: "LQv3c1yqBWVHxkd0LHAkCO"
    - bcrypt rehash a senha com o mesmo salt
    - Compara os hashes: IDÊNTICOS → retorna True → login permitido
    
    Se usuário digitar senha errada:
    - Usuário digita: "SenhaErrada123"
    - bcrypt rehash com o mesmo salt
    - Compara os hashes: DIFERENTES → retorna False → login negado
    
    Args:
        plain_password (str): Senha em texto plano fornecida pelo usuário no login.
                              Exemplo: "MinhaSenh@123"
        
        hashed_password (str): Hash bcrypt armazenado no banco de dados.
                               Exemplo: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/..."
    
    Returns:
        bool: True se a senha fornecida corresponde ao hash (senha correta).
              False se a senha fornecida NÃO corresponde ao hash (senha incorreta).
    
    Raises:
        ValueError: Se hashed_password não for um hash bcrypt válido.
                    Isso pode acontecer se o campo senha_hash no banco estiver corrompido.
    
    Nota de Segurança:
        - Esta função é resistente a timing attacks (tempo de execução constante)
        - Nunca logar a senha em texto plano (nem em desenvolvimento)
        - Sempre usar esta função para validar senhas (nunca comparar strings diretamente)
    """
    # PASSO 1: Converter senha fornecida (string) para bytes
    # bcrypt.checkpw() exige bytes, não aceita strings
    # UTF-8 garante suporte a caracteres especiais (acentos, símbolos, emojis)
    password_bytes = plain_password.encode('utf-8')
    
    # PASSO 2: Converter hash armazenado (string do banco) para bytes
    # O hash foi salvo como string no PostgreSQL, mas bcrypt precisa de bytes
    # Usamos o mesmo encoding (UTF-8) para garantir consistência
    hashed_bytes = hashed_password.encode('utf-8')
    
    # PASSO 3: Comparar senha fornecida com hash usando bcrypt
    # bcrypt.checkpw() faz:
    # 1. Extrai o salt do hash armazenado
    # 2. Aplica bcrypt na senha fornecida usando o mesmo salt
    # 3. Compara os dois hashes byte a byte
    # 4. Retorna True se idênticos, False se diferentes
    # 
    # IMPORTANTE: Esta comparação é em tempo constante (timing-safe)
    # Isso impede ataques que tentam descobrir a senha medindo o tempo de resposta
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict) -> str:
    """
    Gera um token JWT assinado para autenticação do usuário.
    
    FUNCIONAMENTO DETALHADO:
    ------------------------
    Esta função cria um JSON Web Token (JWT) que será usado pelo app móvel
    para autenticar requisições futuras sem precisar enviar email/senha toda vez.
    
    PASSO A PASSO DA GERAÇÃO:
    --------------------------
    1. CÓPIA DO PAYLOAD:
       - Recebe um dicionário com dados do usuário (ex: {"user_id": "123", "email": "user@email.com"})
       - Faz uma cópia para não modificar o dicionário original
       - A cópia permite adicionar campos extras sem efeitos colaterais
    
    2. CÁLCULO DA EXPIRAÇÃO:
       - datetime.utcnow() pega o horário atual em UTC (padrão internacional)
       - timedelta(minutes=30) cria um intervalo de 30 minutos
       - Soma os dois para obter o momento exato de expiração
       - Exemplo: Se agora é 14:00 UTC, expira às 14:30 UTC
       
       POR QUE UTC?
       - UTC não tem horário de verão (evita bugs de timezone)
       - Padrão internacional (funciona em qualquer país)
       - Servidores em nuvem geralmente usam UTC
       - App móvel converte para timezone local se necessário
    
    3. INJEÇÃO DO TIMESTAMP DE EXPIRAÇÃO:
       - Campo "exp" é padrão do JWT (todas as bibliotecas reconhecem)
       - Valor é um timestamp Unix (segundos desde 1970-01-01 00:00:00 UTC)
       - Bibliotecas JWT validam automaticamente se token expirou
       - Se exp < tempo_atual, token é rejeitado com erro "Token expired"
    
    4. ASSINATURA CRIPTOGRÁFICA:
       - jwt.encode() serializa o payload para JSON
       - Aplica Base64 URL-safe encoding no JSON
       - Gera assinatura HMAC-SHA256 usando a SECRET_KEY
       - Concatena: header.payload.signature
       - Resultado: string de ~200 caracteres (ex: "eyJhbGc...")
    
    ESTRUTURA DO TOKEN GERADO:
    --------------------------
    Exemplo de payload antes da codificação:
    {
        "user_id": "123e4567-e89b-12d3-a456-426614174000",  // UUID do usuário
        "email": "usuario@gmail.com",                       // Email do usuário
        "exp": 1709568000                                   // Expira em: 2024-03-04 14:30:00 UTC
    }
    
    Após jwt.encode(), vira uma string:
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjE0MTc0MDAwIiwiZW1haWwiOiJ1c3VhcmlvQGdtYWlsLmNvbSIsImV4cCI6MTcwOTU2ODAwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
    
    SEGURANÇA:
    ----------
    - Token NÃO é criptografado (qualquer um pode decodificar o payload)
    - Mas token É ASSINADO (só quem tem SECRET_KEY pode gerar tokens válidos)
    - Nunca colocar dados sensíveis no payload (senha, cartão de crédito, etc.)
    - Colocar apenas identificadores (user_id, email, roles)
    - Se alguém modificar o payload, a assinatura fica inválida
    
    USO NO APP MÓVEL:
    -----------------
    1. App recebe o token após login bem-sucedido
    2. Armazena no AsyncStorage ou SecureStore
    3. Inclui em todas as requisições: Authorization: Bearer <token>
    4. Backend valida o token em rotas protegidas (middleware)
    5. Se token expirar, app redireciona para tela de login
    
    Args:
        data (dict): Dicionário com dados do usuário a serem incluídos no token.
                     Exemplo: {"user_id": "uuid-aqui", "email": "user@email.com"}
    
    Returns:
        str: Token JWT assinado pronto para ser enviado ao cliente.
             Exemplo: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    
    Raises:
        Nenhuma exceção é lançada diretamente, mas jwt.encode() pode falhar
        se SECRET_KEY for None ou ALGORITHM for inválido.
    """
    # PASSO 1: Criar cópia do payload para não modificar o original
    # O .copy() cria um novo dicionário com os mesmos dados
    # Isso evita efeitos colaterais se a função que chamou ainda usar o dict original
    to_encode = data.copy()
    
    # PASSO 2: Calcular o momento exato de expiração do token
    # datetime.utcnow() = horário atual em UTC (ex: 2024-03-04 14:00:00)
    # timedelta(minutes=30) = intervalo de 30 minutos
    # Soma = 2024-03-04 14:30:00 (momento em que o token expira)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # PASSO 3: Injetar timestamp de expiração no payload
    # Campo "exp" é reconhecido automaticamente por bibliotecas JWT
    # Quando validar o token, se exp < agora, token é rejeitado
    # Exemplo de valor: 1709568000 (segundos desde 1970-01-01 00:00:00 UTC)
    to_encode.update({"exp": expire})
    
    # PASSO 4: Gerar o token JWT assinado
    # jwt.encode() faz 3 coisas:
    # 1. Serializa to_encode para JSON: {"user_id":"123","email":"user@email.com","exp":1709568000}
    # 2. Aplica Base64 encoding: eyJ1c2VyX2lkIjoiMTIzIiwiZW1haWwiOiJ1c2VyQGVtYWlsLmNvbSIsImV4cCI6MTcwOTU2ODAwMH0
    # 3. Gera assinatura HMAC-SHA256 com SECRET_KEY: SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
    # 4. Concatena tudo: header.payload.signature
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    # Retorna o token completo como string
    # Este token será enviado para o app móvel e usado em todas as requisições futuras
    return encoded_jwt
