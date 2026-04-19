# Stumble Tracer Launcher

Launcher personalizado para Stumble Tracer com atualização automática de DLL e interface moderna.

## 🚀 Funcionalidades

- ✅ **Instalação automática** do jogo Stumble Tracer
- ✅ **Atualização automática de DLL** - você atualiza, usuários recebem automaticamente
- ✅ **Interface moderna** com tema ciano azul
- ✅ **Suporte a mods** - DLL colocada automaticamente na pasta `Mods/`
- ✅ **Verificação de integridade** dos arquivos
- ✅ **Painel administrativo** web para gerenciar versões
- ✅ **Discord Rich Presence** integrado
- ✅ **Overlay dinâmico** durante o jogo
- ✅ **Suporte multilíngue** (Português/English/Español)

## 📦 Instalação

### Para Desenvolvedores
```bash
git clone https://github.com/SEU_USERNAME/stumble-tracer-launcher.git
cd stumble-tracer-launcher
npm install
npm run build
```

### Para Usuários Finais
1. Baixe o `Stumble Tracer Launcher Setup.exe` dos [Releases](https://github.com/SEU_USERNAME/stumble-tracer-launcher/releases)
2. Execute o instalador
3. Escolha a pasta onde instalar o jogo
4. O launcher fará download automático dos arquivos

## 🛠️ Configuração para Distribuição

### 1. Hospedar Arquivos de Download

Para que o launcher funcione, você precisa hospedar estes arquivos:

- `version.json` - Informações de versão
- `game.zip` - Arquivos do jogo Stumble Tracer
- `Stumble TracerMod.dll` - Sua DLL personalizada

**Opções gratuitas:**
- **GitHub Releases** (recomendado)
- **GitHub Pages**
- **Netlify** ou **Vercel**
- **Google Drive** (links diretos)

### 2. Atualizar URLs

Edite `main/utils/paths.js`:

```javascript
remote: {
  versionJson: 'https://SEU_USERNAME.github.io/stumble-tracer-launcher/version.json',
  gameDownload: 'https://SEU_USERNAME.github.io/stumble-tracer-launcher/game.zip',
  dllDownload: 'https://SEU_USERNAME.github.io/stumble-tracer-launcher/Stumble TracerMod.dll',
  newsApi: 'https://SEU_USERNAME.github.io/stumble-tracer-launcher/news.json'
}
```

### 3. Criar Release

1. Vá para **Releases** no seu repositório
2. Clique **"Create a new release"**
3. **Tag**: `v1.0.0`
4. **Title**: `Stumble Tracer Launcher v1.0.0`
5. **Description**: Descreva as mudanças
6. **Attach**: `Stumble Tracer Launcher Setup.exe`

## 🎮 Como Usar

1. **Primeira execução**: O launcher verifica se o jogo está instalado
2. **Se não estiver**: Faz download automático do `game.zip`
3. **Sempre**: Baixa a versão mais recente da DLL para `Mods/Stumble TracerMod.dll`
4. **Jogo**: Inicia `Stumble Tracer.exe` com mods aplicados

## 🖥️ Painel Administrativo

O launcher inclui um website para gerenciar versões:

```bash
cd game website
npm install
npm start
```

Acesse: `http://localhost:3000`

- Gerencie versões do jogo
- Faça upload de novas DLLs
- Monitore downloads e usuários
- Configure notícias e anúncios

## 🔧 Desenvolvimento

### Estrutura do Projeto
```
├── main/                 # Código principal do Electron
│   ├── modules/         # Módulos do launcher
│   └── utils/           # Utilitários
├── renderer/            # Interface do usuário
│   ├── css/            # Estilos (tema ciano)
│   ├── js/             # Scripts da interface
│   └── assets/         # Imagens e recursos
├── game website/        # Painel administrativo
├── resources/          # Configurações padrão
└── dist/               # Builds compilados
```

### Build
```bash
npm run build  # Cria executável Windows
```

### Desenvolvimento
```bash
npm start      # Executa em modo desenvolvimento
```

## 📋 Requisitos

- **Windows 10/11**
- **Node.js 18+** (para desenvolvimento)
- **Conexão com internet** (para downloads)
- **Espaço em disco**: ~500MB para jogo + mods

## 🔐 Segurança

- Verificação de integridade dos arquivos
- Autenticação no painel administrativo
- HWID tracking para analytics
- Downloads seguros com headers de autenticação

## 🌐 Idiomas Suportados

- 🇧🇷 **Português (Brasil)**
- 🇺🇸 **English**
- 🇪🇸 **Español**

## 📞 Suporte

Para suporte técnico ou dúvidas:
- Abra uma **Issue** no GitHub
- Entre em contato com a comunidade

## 📄 Licença

Este projeto é distribuído sob licença MIT. Veja `LICENSE` para detalhes.

---

**Desenvolvido com ❤️ para a comunidade Stumble Tracer**