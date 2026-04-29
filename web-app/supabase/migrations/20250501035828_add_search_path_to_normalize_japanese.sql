-- normalize_japanese 関数に search_path 固定を追加
CREATE OR REPLACE FUNCTION public.normalize_japanese(input text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  STRICT
  SET search_path = public, pg_temp
AS $$
  SELECT normalize(lower(input), nfkc);
$$;

COMMENT ON FUNCTION public.normalize_japanese(text)
  IS 'Normalizes Japanese text using NFKC and lowercasing for consistent searching.';
