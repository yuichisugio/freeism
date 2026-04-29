DROP INDEX IF EXISTS pgroonga_task_text_mecab_idx;
DROP INDEX IF EXISTS pgroonga_task_text_bigram_idx;

create index if not exists pgroonga_task_text_mecab_idx
on public."Task"
using pgroonga (public.normalize_japanese(task || ' ' || coalesce(detail, '')))
with (tokenizer = 'TokenMecab', normalizer = 'NormalizerAuto');

create index if not exists pgroonga_task_text_bigram_idx
on public."Task"
using pgroonga (public.normalize_japanese(task || ' ' || coalesce(detail, '')))
with (tokenizer = 'TokenBigram', normalizer = 'NormalizerAuto');
