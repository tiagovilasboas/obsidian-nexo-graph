# Nexo Graph — backlog de maturidade

> Escopo iniciado em `feat/neural-circular-field` sobre Signal Field em 2026-09-28. Este backlog descreve apenas comportamento presente ou trabalho explicitamente pendente; o Graph Styler e presets de tema não fazem parte do produto atual.

## Princípios e contrato de Harness Engineering

Cada incremento precisa de um **guia** (documentação, comportamento esperado ou configuração antes do uso) e de um **sensor** (teste, validação ou inspeção depois da mudança). Classifique cada mudança como **computacional** ou **inferencial**, e nos eixos de **maintainability**, **architecture fitness** ou **behaviour**. Sensores computacionais devem rodar antes do commit e no PR/CI; a verificação visual no Obsidian é um sensor inferencial e deve ser registrada sem dados privados do vault.

## Estado atual verificado

- [x] Engine SVG determinística; campo circular com distribuição global e relaxamento limitado por nota/conexão, sem animação contínua.
- [x] Quatro grupos configuráveis por prefixos e cores; notas sem correspondência ficam em `Other`.
- [x] Busca, filtros com contagem, zoom/pan, exploração local até três hops e menu contextual.
- [x] Links extraídos de `metadataCache.resolvedLinks`; prefixo de pasta apenas classifica e colore.
- [x] Atualização do grafo após eventos de vault e metadata cache.
- [x] Limites de 500 nós e 1.600 links com amostragem determinística.
- [x] Signal Field com core neutro, malha neural circular, curvas cross-domain e rótulos limitados em grafos moderados/densos.
- [x] Hierarquia de nós refinada com raio máximo menor e preenchimento translúcido; seleção usa contorno leve e halo sem aumentar a bolinha.
- [x] CI para sintaxe, bundle, testes da engine e contrato do manifesto.
- [x] CI compara a superfície pública de API registrada com o `minAppVersion` declarado.
- [x] Release workflow passa a tag publicada como dado quoted; teste impede interpolação direta no shell.
- [x] CI calcula contraste sRGB dos labels de filtros desmarcados e bloqueia valores abaixo de 4,5:1.
- [x] Transições de teclado dos nós testadas (Enter abre, Space seleciona/desselciona, Escape limpa, Shift+F10/menu abre).
- [x] Wiring de eventos do Obsidian e migração/persistência de configurações testados com API stubs.
- [x] Testes de contrato com fake DOM para renderização SVG/foco, teclado, menu contextual, pointer e debounce de atualização; integração DOM/runtime real do Obsidian continua limitada ao smoke manual.
- [x] Gate computacional para caixas estimadas de rótulos automáticos e margem do core/viewBox.
- [ ] Baseline visual sintético público em Obsidian; a inspeção privada no vault real não substitui fixtures visuais sintéticas versionadas. A métrica computacional de cruzamento de arestas foi entregue, mas ainda não está conectada a uma captura/renderização real.
- [x] Layout neural circular com grupos misturados, influência leve das conexões, afastamento do core e limite de raio por testes determinísticos; revisão visual em Obsidian permanece pendente.
- [x] Nome dos quatro grupos configurável pela UI; cobertura de persistência por UI/API ainda pendente.
- [ ] Instalação limpa/release verificada visualmente no Obsidian para a versão atual.

## Próximas tarefas

### NEXO-001 — Grupos nomeáveis e configuração robusta — P0 · parcial

- **Guia:** UI explica nome, prefixos, cor, precedência de prefixo e grupo `Other`; exemplos incluem `Rules`, `Agents` e `Architecture`.
- **Sensor computacional:** testes de API stub cobrem migração de grupos legados, nome customizado, saveData/loadData e caminhos ignorados; confirmação no app instalado ainda pendente.
- **Classificação:** comportamento e architecture fitness; guia computacional/documental + sensor computacional.
- **Entregue:** nome por vault editável; filtros, legenda e rótulo do campo refletem a configuração ao salvar; teste de migração/persistência por stubs passa. Compatibilidade de runtime ainda depende de smoke test real.

### NEXO-002 — Signal Field como malha neural circular — P0 · implementação em revisão

- **Guia:** contrato de layout descreve distribuição circular determinística, atração leve dos links, repulsão local e espaço livre para o core.
- **Sensor computacional:** fixtures garantem determinismo entre ordens de entrada, grupos distribuídos pelos quatro quadrantes, clearance do core, limite circular e orçamento de 500 notas/1.600 links.
- **Sensor inferencial:** revisar no Obsidian fixtures sintéticas pequenas, médias e densas, em largura normal e estreita; ainda pendente.
- **Classificação:** behaviour e architecture fitness; guia inferencial/documental + sensores computacional e inferencial.
- **Aceite computacional:** grupos não se segregam em ilhas, posições repetem em renders equivalentes, core fica livre e contorno permanece circular; testes entregues. Visual no Obsidian ainda precisa validação.

### NEXO-003 — Contrato de acessibilidade e movimento — P0 · sensores computacionais entregues; revisão manual pendente

- **Guia:** documenta fluxo de teclado, foco, alternativa a hover e comportamento com `prefers-reduced-motion`.
- **Sensor computacional:** valida foco visível para todos os controles, contraste mínimo de 4,5:1 nos labels de filtros desmarcados, ausência de animação não essencial no modo reduzido e um SVG com papel de grupo interativo, em vez de imagem, contendo botões de nota focáveis; executa na CI.
- **Sensor inferencial:** revisão manual de teclado e leitor de tela no Obsidian.
- **Classificação:** behaviour; guia inferencial + sensores computacional e inferencial.
- **Aceite:** controles/nós são operáveis por teclado, o container do SVG não achata botões de nota como uma única imagem, foco não depende de cor sozinha e sinal de fundo não se move em reduced motion. O contrato não substitui revisão manual com leitor de tela no Obsidian.

### NEXO-004 — Testes de integração da view — P0

- **Guia:** README registra Enter, Space, Escape, Shift+F10, Local mode e atualização de conteúdo.
- **Sensor computacional:** contrato de teclas, wiring de eventos, migração/persistência e fake DOM para SVG, foco, teclas, seleção, pointer, menu e debounce passam em CI; limite de links também renderizado sob teste.
- **Classificação:** maintainability e behaviour; guia documental + sensor computacional.
- **Entregue parcialmente:** Enter/Space/Escape/ContextMenu/Shift+F10, subscriptions de vault/metadata, migração de nomes e saveData/loadData são cobertos por sensores computacionais. O fake DOM cobre SVG, foco, pointer e debounce, mas não prova o runtime completo do Obsidian nem o menu nativo real; esse smoke manual continua pendente.

### NEXO-005 — Legibilidade e desempenho em grafos densos — P1 · parcial

- **Guia:** documenta limites atuais e critérios visuais que não prometem ausência total de colisões.
- **Sensor computacional:** fixtures sintéticas medem clearance do core/viewBox, limites de nós/arestas, colisão estimada entre labels e box do core, cruzamentos aproximados de curvas SVG quadráticas e orçamento de renderização.
- **Sensor inferencial:** screenshots apenas sintéticos em tamanhos pequeno/médio e revisão visual sem conteúdo do RAG. Revisão privada no Obsidian em 2026-09-28 encontrou rótulos congestionados em 40 notas; após recarga completa, confirmou a renderização mais limpa e a legenda sem domínio vazio. Nenhuma captura ou nome de nota do vault foi versionado.
- **Progresso visual desta branch:** o perfil sintético denso (500 notas/1.600 links) foi aberto no Obsidian 1.13.7 em largura padrão e mostrou um campo circular contínuo; ainda faltam os perfis pequeno/médio, largura estreita e baseline pública renderizada.
- **Classificação:** behaviour e maintainability; guia inferencial/documental + sensores computacional e inferencial.
- **Entregue parcialmente:** sensor determinístico rejeita colisões entre caixas de texto estimadas e contra a caixa do título do core; as caixas usam estimativa conservadora de fonte mono e não provam a geometria final do browser. Guias/testes ativam supressão por colisão a partir de 32 notas e removem grupos sem notas da legenda. Um sensor sintético mede interseções entre curvas amostradas, inclusive em vértices interiores da amostra, ignora extremidades das curvas e exclui pares com endpoint lógico compartilhado; pode omitir tangências, sobreposições e cruzamentos pequenos entre amostras, e contar quase-tangências como contato. Smoke visual no Obsidian passou em vault privado com 40 notas/98 links; baseline visual sintético versionado/renderizado continua pendente.

### NEXO-007 — Hierarquia de links cross-domain — P1 · entregue, QA visual pendente

- **Guia:** o contrato visual mantém todos os links amostrados e suas rotas determinísticas; em repouso, links cross-domain usam opacidade menor ou igual à dos links locais. Curvatura, stroke e foco/busca preservam sua leitura quando o usuário investiga uma relação.
- **Sensor computacional:** contrato de CSS bloqueia links cross-domain mais opacos do que links locais e exige que links dimmed permaneçam abaixo de ambos; fixture de engine confirma contagem e pares de links resolvidos sem alteração pela hierarquia de apresentação.
- **Sensor inferencial:** repetir a revisão em vault sintético denso nas larguras normal e estreita, registrando apenas screenshots públicas e o resultado visual.
- **Classificação:** behaviour; guia inferencial/documental + sensores computacional e inferencial. O sensor computacional verifica hierarquia declarada e verdade dos links, mas não mede estética no SVG renderizado.

### NEXO-008 — Fixtures sintéticas reproduzíveis — P1 · entregue, baseline visual pendente

- **Guia:** `docs/visual-baseline/SYNTHETIC.md` descreve comandos para perfis pequeno, médio e denso e exige diretórios temporários vazios. As notas, pastas e links são genéricos; o gerador nunca recebe dados do RAG/Voomp.
- **Sensor computacional:** testes determinísticos verificam perfis de 12/24, 96/384 e 500/1.600 notas/links, nomes de caminhos genéricos, configuração do plugin e assets locais copiados para um vault novo. O gerador recusa diretório de saída não vazio e caminhos de fixture que escapariam desse diretório.
- **Sensor inferencial:** abrir cada perfil no Obsidian, revisar larguras normal/estreita e registrar apenas screenshots públicas junto de versão, viewport e resultado.
- **Classificação:** maintainability e behaviour; guia documental + sensores computacional e inferencial. A fixture torna a revisão repetível, sem substituí-la por um teste de arquivos.

### NEXO-006 — Robustez de release e documentação — P1 · parcial

- **Guia:** instruções de desenvolvimento e release refletem a versão/tag e a origem de cada asset.
- **Sensor computacional:** bundle e tag assets têm verificadores; contrato do workflow impede interpolação de texto da release no shell; inventário explícito da API pública e piso `@since` rodam na CI. Compatibilidade da versão mínima e smoke test de instalação limpa ainda pendentes.
- **Sensor inferencial:** instalação limpa e smoke test no Obsidian; registrar versão e resultado sem alegar prova por configuração. Em 2026-09-28, a `main`/manifest está em 0.4.0 e a última release publicada em 0.3.0; README agora informa essa diferença.
- **Classificação:** maintainability e architecture fitness; guia documental + sensores computacional e inferencial.
- **Entregue parcialmente:** assets são validados byte a byte contra tag, o tag não é interpretado como shell, API pública registrada é checada contra o piso do manifesto, e o README avisa sobre a diferença entre source e latest release; falta smoke test da instalação limpa na menor versão suportada. Publicar release continua uma ação separada.

## Sequência recomendada

1. NEXO-001 + NEXO-002: suportar grupos reais como `Rules` sem deformar a linguagem Signal Field.
2. NEXO-003 + NEXO-004: fechar acessibilidade e comportamento da view com sensores em CI.
3. NEXO-005: estabelecer baseline sintético denso e medidas de legibilidade.
4. NEXO-006: fechar qualidade da distribuição e documentação por release.

## Fora do escopo aprovado

- Substituir o Signal Field por código antigo de Graph Styler ou reintroduzir features não presentes na `main`.
- Adicionar dependência de física/visualização sem medição que prove necessidade.
- Usar conteúdo ou screenshots do RAG/Voomp como fixture pública.
- Criar clusters sem sinal semântico explícito nos dados.
