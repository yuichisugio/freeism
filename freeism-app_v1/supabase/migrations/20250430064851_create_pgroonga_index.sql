CREATE EXTENSION IF NOT EXISTS pgroonga with schema extensions;

create index if not exists pgroonga_task_text_mecab_idx
on public."Task"
using pgroonga ((task || ' ' || detail))
with (tokenizer = 'TokenMecab', normalizer = 'NormalizerAuto');

create index if not exists pgroonga_task_text_bigram_idx
on public."Task"
using pgroonga ((task || ' ' || detail))
with (tokenizer = 'TokenBigram', normalizer = 'NormalizerAuto');
