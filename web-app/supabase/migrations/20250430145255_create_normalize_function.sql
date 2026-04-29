-- 日本語テキストを正規化する IMMUTABLE 関数を作成
-- IMMUTABLE にすることでインデックスでの利用が可能になる
create or replace function public.normalize_japanese(text)
returns text
language sql
immutable -- 関数が同じ入力に対して常に同じ結果を返し、DB状態に依存しないことを示す
strict    -- 引数のいずれかがNULLの場合、自動的にNULLを返す
as $$
  -- NFKC正規化と小文字化を適用
  select normalize(lower($1), nfkc);
$$;

-- (オプション) 関数にコメントを追加
comment on function public.normalize_japanese(text) is 'Normalizes Japanese text using NFKC and lowercasing for consistent searching.';
