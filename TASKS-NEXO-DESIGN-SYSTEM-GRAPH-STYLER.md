# Nexo Graph — backlog de maturidade

> Escopo sincronizado com `main` / Signal Field em 2026-09-28. Este backlog descreve apenas comportamento presente ou trabalho explicitamente pendente; o Graph Styler, presets de tema e layout físico não fazem parte do produto atual.

## Princípios e contrato de Harness Engineering

Cada incremento precisa de um **guia** (documentação, comportamento esperado ou configuração antes do uso) e de um **sensor** (teste, validação ou inspeção depois da mudança). Classifique cada mudança como **computacional** ou **inferencial**, e nos eixos de **maintainability**, **architecture fitness** ou **behaviour**. Sensores computacionais devem rodar antes do commit e no PR/CI; a verificação visual no Obsidian é um sensor inferencial e deve ser registrada sem dados privados do vault.

## Estado atual verificado

- [x] Engine SVG determinística; posições distribuídas em âncoras fixas, sem simulação física contínua.
- [x] Quatro grupos configuráveis por prefixos e cores; notas sem correspondência ficam em `Other`.
- [x] Busca, filtros com contagem, zoom/pan, exploração local até três hops e menu contextual.
- [x] Links extraídos de `metadataCache.resolvedLinks`; prefixo de pasta apenas classifica e colore.
- [x] Atualização do grafo após eventos de vault e metadata cache.
- [x] Limites de 500 nós e 1.600 links com amostragem determinística.
- [x] Signal Field com core neutro, domínios ativos, curvas cross-domain e rótulos limitados em grafos moderados/densos.
- [x] CI para sintaxe, bundle, testes da engine e contrato do manifesto.
- [x] Release workflow passa a tag publicada como dado quoted; teste impede interpolação direta no shell.
- [x] Transições de teclado dos nós testadas (Enter abre, Space seleciona/desselciona, Escape limpa, Shift+F10/menu abre).
- [x] Wiring de eventos do Obsidian e migração/persistência de configurações testados com API stubs.
- [ ] Testes DOM para renderização SVG/foco, menu contextual, pointer e debounce de atualização.
- [x] Gate computacional para caixas estimadas de rótulos automáticos e margem do core/viewBox.
- [ ] Medidas de cruzamentos de aresta e baseline visual sintético público em Obsidian; a inspeção privada no vault real não substitui fixtures visuais sintéticas versionadas.
- [x] Centros/halos adaptados ao conjunto de grupos ativos por teste determinístico; falta revisão visual em Obsidian.
- [x] Nome dos quatro grupos configurável pela UI; cobertura de persistência por UI/API ainda pendente.
- [ ] Instalação limpa/release verificada visualmente no Obsidian para a versão atual.

## Próximas tarefas

### NEXO-001 — Grupos nomeáveis e configuração robusta — P0 · parcial

- **Guia:** UI explica nome, prefixos, cor, precedência de prefixo e grupo `Other`; exemplos incluem `Rules`, `Agents` e `Architecture`.
- **Sensor computacional:** testes de API stub cobrem migração de grupos legados, nome customizado, saveData/loadData e caminhos ignorados; confirmação no app instalado ainda pendente.
- **Classificação:** comportamento e architecture fitness; guia computacional/documental + sensor computacional.
- **Entregue:** nome por vault editável; filtros, legenda e rótulo do campo refletem a configuração ao salvar; teste de migração/persistência por stubs passa. Compatibilidade de runtime ainda depende de smoke test real.

### NEXO-002 — Signal Field adaptativo a grupos com conteúdo — P0 · implementação entregue; QA visual pendente

- **Guia:** contrato de layout descreve distribuição determinística dos domínios ativos e posição estável do core.
- **Sensor computacional:** fixtures de 1, 2, 3 e 4 grupos ativos garantem determinismo, distâncias mínimas e ausência de halo/rótulo vazio.
- **Sensor inferencial:** revisão no Obsidian com vault sintético pequeno e médio confirma hierarquia e espaço útil; ainda pendente.
- **Classificação:** behaviour e architecture fitness; guia inferencial/documental + sensores computacional e inferencial.
- **Aceite computacional:** grupos vazios não recebem centro/halo/rótulo, centros repetem entre renders, e notas `Other` ficam fora do miolo central; testes entregues. Visual de Obsidian ainda precisa validação.

### NEXO-003 — Contrato de acessibilidade e movimento — P0

- **Guia:** documenta fluxo de teclado, foco, alternativa a hover e comportamento com `prefers-reduced-motion`.
- **Sensor computacional:** valida foco visível para todos os controles e ausência de animação não essencial no modo reduzido.
- **Sensor inferencial:** revisão manual de teclado e leitor de tela no Obsidian.
- **Classificação:** behaviour; guia inferencial + sensores computacional e inferencial.
- **Aceite:** controles/nós são operáveis por teclado, foco não depende de cor sozinha e sinal de fundo não se move em reduced motion.

### NEXO-004 — Testes de integração da view — P0

- **Guia:** README registra Enter, Space, Escape, Shift+F10, Local mode e atualização de conteúdo.
- **Sensor computacional:** contrato de teclas, wiring de eventos e migração/persistência passam com stubs; harness DOM para renderização, foco/pointer, menu e debounce ainda pendente.
- **Classificação:** maintainability e behaviour; guia documental + sensor computacional.
- **Entregue parcialmente:** Enter/Space/Escape/ContextMenu/Shift+F10, subscriptions de vault/metadata, migração de nomes e saveData/loadData são cobertos por sensores computacionais. Integração DOM/render, menu nativo e debounce ainda pendentes.

### NEXO-005 — Legibilidade e desempenho em grafos densos — P1 · parcial

- **Guia:** documenta limites atuais e critérios visuais que não prometem ausência total de colisões.
- **Sensor computacional:** fixtures sintéticas medem clearance do core/viewBox, limites de nós/arestas, colisão estimada de labels e orçamento de renderização.
- **Sensor inferencial:** screenshots apenas sintéticos em tamanhos pequeno/médio e revisão visual sem conteúdo do RAG. Revisão privada no Obsidian em 2026-09-28 encontrou rótulos congestionados em 40 notas; após recarga completa, confirmou a renderização mais limpa e a legenda sem domínio vazio. Nenhuma captura ou nome de nota do vault foi versionado.
- **Classificação:** behaviour e maintainability; guia inferencial/documental + sensores computacional e inferencial.
- **Entregue parcialmente:** sensor determinístico rejeita colisões entre caixas de texto estimadas e protege limites do core/viewBox; guias/testes agora ativam supressão por colisão a partir de 32 notas e removem grupos sem notas da legenda. Smoke visual no Obsidian passou em vault privado com 40 notas/98 links; faltam cruzamentos de aresta medidos e baseline visual sintético versionado.

### NEXO-006 — Robustez de release e documentação — P1 · parcial

- **Guia:** instruções de desenvolvimento e release refletem a versão/tag e a origem de cada asset.
- **Sensor computacional:** bundle e tag assets têm verificadores; contrato do workflow impede interpolação de texto da release no shell. Compatibilidade da versão mínima e smoke test de instalação ainda pendentes.
- **Sensor inferencial:** instalação limpa e smoke test no Obsidian; registrar versão e resultado sem alegar prova por configuração. Em 2026-09-28, a `main`/manifest está em 0.4.0 e a última release publicada em 0.3.0; README agora informa essa diferença.
- **Classificação:** maintainability e architecture fitness; guia documental + sensores computacional e inferencial.
- **Entregue parcialmente:** assets são validados byte a byte contra tag, o tag não é interpretado como shell, e o README avisa sobre a diferença entre source e latest release; falta automatizar compatibilidade de API e smoke test de instalação limpa. Publicar release continua uma ação separada.

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
