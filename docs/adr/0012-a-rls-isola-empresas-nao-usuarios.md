# A RLS isola empresas entre si, não usuários do próprio serviço

As tabelas do Auth.js — `user`, `account`, `session`, `verificationToken` — ficam **fora da Row-Level
Security**. Qualquer query do papel da aplicação lê todas as linhas delas. Toda tabela de domínio, ao
contrário, tem policy por empresa, e a de escrita exige ainda que o usuário corrente seja `editor` naquela
empresa (RF-23).

Um leitor que veja RLS em doze tabelas e nenhuma nas quatro de autenticação vai supor esquecimento. Não é.

## Por quê

A policy lê `current_setting('app.empresa_id')` e `current_setting('app.usuario_id')`, declarados por
transação depois de a aplicação conferir o vínculo. **O login acontece antes de existir usuário para
declarar**: o Auth.js lê `verificationToken` para validar o magic link, e `session` para saber quem está
chegando. Uma policy por usuário nessas tabelas daria resposta nula exatamente nesse instante — e com `FORCE
ROW LEVEL SECURITY`, nula significa vazia. O login quebraria em silêncio.

A alternativa de declarar o usuário a partir do token, antes de validá-lo, é declarar a partir de algo que
ainda não foi conferido — o mesmo erro que a RLS existe para impedir, só que na entrada.

## O que protege essas tabelas, então

O papel da aplicação ser **nosso**, e a conexão ser **uma**. Não há query de usuário final contra o banco;
há Server Actions que passam pelo Auth.js antes de tocar em qualquer coisa. O limite é consciente: a RLS
garante que a Boa Safra nunca vê o Vale Verde, mesmo com bug na aplicação. Ela **não** garante que um bug
na aplicação não leia a lista de e-mails de todos os usuários — isso é garantido pela aplicação, e é uma
promessa mais fraca.

## Consequências

`comEmpresa` declara empresa **e** usuário. Sem usuário declarado, nenhuma policy de escrita passa — a
ausência fecha, como em todo o resto da RLS.

A policy de escrita exige `editor` via subconsulta em `usuario_empresa`, que por sua vez tem policy por
empresa. A subconsulta passa porque pergunta pela mesma empresa que já está declarada; não há recursão.

**Empresa é criada fora da RLS**, pelo papel de migração — `semear` e `vincular`. O primeiro vínculo de uma
empresa não pode ser gravado por um editor dela, porque ainda não há nenhum. A policy `empresa_criacao` fica
em `with check (true)` como dívida com data: reabrir quando existir auto-cadastro.

Dois papéis de banco, sempre: o dono migra e semeia; `aplicacao` serve o app. `FORCE` faz a policy valer
para o dono, mas não contém superusuário — a string de conexão do app nunca é a de migração.
