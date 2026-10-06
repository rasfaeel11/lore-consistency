# Fechamento da sessão

1. estado.md
   - cap-02: o degelo chega; durante o toque de cheia, Lia ouve um estalo na torre; Irena Sol diz que ouve o mesmo há vinte anos.
   - Setup novo: o estalo na torre no dia da cheia | cap-02 | alguém esfria o sino de propósito.
   - Resumo geral: Lia agora sabe que alguém sobe à torre no dia da cheia.
2. Fichas
   - lia-brandt: dois fatos novos (cap-02) e `aparece_em` com o cap-02.
   - Ficha nova: irena-sol, barqueira do Aral.
3. alfabeto.md
   - Irena Sol | barqueira do Aral | montanheses | cap-02.
4. Pendências: quem tem a chave da torre?

## NÃO APROVADO
- Irena ser irmã de Oto.
- O estalo ser ouvido da cidade inteira.

```lore-pack-mudancas
{
  "operacoes": [
    {
      "op": "estado_adicionar",
      "secao": "Capítulos",
      "linhas": [
        "- cap-02: O degelo chega. Durante o toque de cheia, Lia ouve um estalo na torre do Sino Mudo. No cais, a barqueira Irena Sol diz que ouve o mesmo estalo há vinte anos."
      ]
    },
    {
      "op": "estado_adicionar",
      "secao": "Setups abertos",
      "linhas": [
        "- o estalo na torre no dia da cheia | cap-02 | alguém esfria o sino de propósito"
      ]
    },
    {
      "op": "estado_substituir",
      "antigo": "Lia entrou na Fundição Alta como aprendiz e quer entender por que o Sino Mudo nunca foi refundido.",
      "novo": "Lia, aprendiz na Fundição Alta, descobriu que alguém sobe à torre do Sino Mudo no dia da cheia."
    },
    {
      "op": "ficha_adicionar",
      "id": "lia-brandt",
      "secao": "Fatos",
      "linhas": [
        "- Tocou o toque de cheia no sino da ponte (cap-02).",
        "- Ouviu um estalo na torre durante a cheia (cap-02)."
      ]
    },
    {
      "op": "ficha_substituir",
      "id": "lia-brandt",
      "antigo": "aparece_em: [cap-01]",
      "novo": "aparece_em: [cap-01, cap-02]"
    },
    {
      "op": "ficha_criar",
      "tipo": "personagem",
      "id": "irena-sol",
      "conteudo": "---\nid: irena-sol\ntipo: personagem\nnome: Irena Sol\naliases: [a barqueira]\nstatus: viva\naparece_em: [cap-02]\n---\n**Essencial (1 linha):** barqueira do Aral, quarenta anos, mora no cais e repara em tudo.\n\n**Fatos** (telegráfico, com capítulo de origem):\n- Perdeu o barco na cheia (cap-02).\n- Ouve um estalo na torre todo ano, no dia da cheia, há vinte anos (cap-02).\n\n**Relações:**\n- Lia Brandt: primeira pessoa de fora da Fundição que fala com ela sobre a torre.\n\n**Segredos (o leitor ainda não sabe):**\n- Viu quem subiu à torre na noite em que o sino rachou.\n"
    },
    {
      "op": "alfabeto_adicionar",
      "linhas": [
        "- Irena Sol | barqueira do Aral | montanheses | cap-02"
      ]
    },
    {
      "op": "nao_aprovado",
      "itens": [
        "Irena ser irmã de Oto.",
        "O estalo ser ouvido da cidade inteira."
      ]
    }
  ]
}
```
