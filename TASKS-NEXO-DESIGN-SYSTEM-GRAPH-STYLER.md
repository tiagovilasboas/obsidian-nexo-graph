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
- [x] Signal Field com core neutro, quatro domínios, curvas cross-domain e rótulos limitados em grafos densos.
- [x] CI para sintaxe, bundle, testes da engine e contrato do manifesto.
- [ ] Testes de integração DOM/API Obsidian para teclado, foco, menu contextual, eventos e persistência.
- [ ] Métricas automatizadas de colisões/legibilidade em grafo denso e baseline visual sintético.
- [ ] Centros/halos adaptados ao conjunto de grupos ativos; a geometria atual reserva quatro setores mesmo quando vazios.
- [ ] Nome dos grupos configurável pela UI; hoje nomes vêm dos grupos padrão e a UI expõe prefixos e cores.
- [ ] Instalação limpa/release verificada visualmente no Obsidian para a versão atual.

## Próximas tarefas

### NEXO-001 — Grupos nomeáveis e configuração robusta — P0

- **Guia:** UI explica nome, prefixos, cor, precedência de prefixo e grupo `Other`; exemplos incluem `Rules`, `Agents` e `Architecture`.
- **Sensor computacional:** testes cobrem migração de configuração legada, nomes/prefixos personalizados, grupos vazios e persistência em `saveData/loadData`.
- **Classificação:** comportamento e architecture fitness; guia computacional/documental + sensor computacional.
- **Aceite:** grupos podem ser renomeados por vault sem perder settings legados e atualizam filtros, legenda, core view e classificação.

### NEXO-002 — Signal Field adaptativo a grupos com conteúdo — P0

- **Guia:** contrato de layout descreve distribuição determinística dos domínios ativos e posição estável do core.
- **Sensor computacional:** fixtures de 1, 2, 3 e 4 grupos ativos garantem determinismo, distâncias mínimas e ausência de halo/rótulo vazio.
- **Sensor inferencial:** revisão no Obsidian com vault sintético pequeno e médio confirma hierarquia e espaço útil.
- **Classificação:** behaviour e architecture fitness; guia inferencial/documental + sensores computacional e inferencial.
- **Aceite:** grupos vazios não reservam espaço dominante; o layout continua estável entre renders e não encobre o core.

### NEXO-003 — Contrato de acessibilidade e movimento — P0

- **Guia:** documenta fluxo de teclado, foco, alternativa a hover e comportamento com `prefers-reduced-motion`.
- **Sensor computacional:** valida foco visível para todos os controles e ausência de animação não essencial no modo reduzido.
- **Sensor inferencial:** revisão manual de teclado e leitor de tela no Obsidian.
- **Classificação:** behaviour; guia inferencial + sensores computacional e inferencial.
- **Aceite:** controles/nós são operáveis por teclado, foco não depende de cor sozinha e sinal de fundo não se move em reduced motion.

### NEXO-004 — Testes de integração da view — P0

- **Guia:** README registra Enter, Space, Escape, Shift+F10, Local mode e atualização de conteúdo.
- **Sensor computacional:** harness mínimo de DOM + API Obsidian testa eventos, debounce, teclas, persistência e menu sem dependência de runtime privado.
- **Classificação:** maintainability e behaviour; guia documental + sensor computacional.
- **Aceite:** fluxos da view têm regressão automatizada e continuam usando apenas a API pública documentada.

### NEXO-005 — Legibilidade e desempenho em grafos densos — P1

- **Guia:** documenta limites atuais e critérios visuais que não prometem ausência total de colisões.
- **Sensor computacional:** fixture sintética mede distância ao core, limites de nós/arestas, colisão estimada de labels e orçamento de renderização.
- **Sensor inferencial:** screenshots apenas sintéticos em tamanhos pequeno/médio e revisão visual sem conteúdo do RAG.
- **Classificação:** behaviour e maintainability; guia inferencial/documental + sensores computacional e inferencial.
- **Aceite:** baseline reproduzível, thresholds justificados e regressões detectáveis sem exportar conteúdo privado.

### NEXO-006 — Robustez de release e documentação — P1

- **Guia:** instruções de desenvolvimento e release refletem a versão/tag e a origem de cada asset.
- **Sensor computacional:** CI confirma que bundle gerado não contém imports locais, assets coincidem com tag e manifesto é compatível com a versão mínima suportada.
- **Sensor inferencial:** instalação limpa e smoke test no Obsidian; registrar versão e resultado sem alegar prova por configuração.
- **Classificação:** maintainability e architecture fitness; guia documental + sensores computacional e inferencial.
- **Aceite:** assets publicados são reproduzíveis a partir do tag e a documentação não promete recursos ausentes.

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
