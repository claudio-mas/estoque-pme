# Sem senha: entra-se por link no e-mail

O app não tem senha. O usuário informa o e-mail, recebe um link, e o link abre a sessão — magic link via
Auth.js, com a sessão gravada no nosso Postgres (`session`), não em JWT.

Um leitor vai procurar a tela de senha e não vai achar. Não é lacuna.

## Por quê

Senha traz junto reset de senha, política de complexidade, bloqueio por tentativas e um hash que é nosso
para errar. Nada disso é o produto. E o provedor Credentials do Auth.js — o único caminho para senha lá —
**só funciona com sessão JWT**: a promessa da stack de "PII no nosso Postgres, sessão no nosso banco"
morreria na primeira tela.

Magic link é um provedor de e-mail e nada mais. A PME brasileira já vive de e-mail: o balancete chega por
e-mail, o contador responde por e-mail. Não há hábito novo a criar.

OAuth Google foi considerado e recusado por pressupor Google Workspace, que o controller de uma indústria de
alimentos de médio porte frequentemente não usa.

## Alternativas recusadas

**Sem login no primeiro corte** — empresa fixa por variável de ambiente, sessão simulada. Construiria o app
sobre uma sessão que não existe, e a RLS, que é o pedaço mais importante do backend, ficaria sem exercício
até o segundo corte. O login existe hoje justamente para a RLS ser testada com sessão de verdade.

**Auth.js v4** — é da era do Pages Router. O v5 está em beta há muito tempo, e o risco é de API instável, não
de segurança; é o que funciona com App Router.

## Consequências

**O transporte é SMTP genérico** via Nodemailer, escolhido no deploy. O provedor de e-mail é operador de
dado pessoal — endereço e link de acesso —, e a nota de LGPD do `CLAUDE.md` existe para não abrir a conversa
de transferência internacional. Resend, que o Auth.js tem como provedor nativo, é americano; escolhê-lo seria
escolher essa conversa. SMTP genérico aponta para SES em São Paulo, para um provedor brasileiro ou para o que
o primeiro cliente exigir, sem tocar em código.

**Sem `SMTP_URL`, o link sai no terminal.** É o que faz o login funcionar em desenvolvimento sem conta de
e-mail em lugar nenhum — e é só desenvolvimento.

O link vale uma vez e por pouco tempo (`verificationToken`). Quem perde o e-mail pede outro.
