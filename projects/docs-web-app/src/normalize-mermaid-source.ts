const UNQUOTED_EDGE_LABEL_WITH_PARENTHESES =
  /\|([^|"\n]*\([^|"\n]*\)[^|"\n]*)\|/gu;

export const normalizeMermaidSource = (source: string) =>
  source.replace(
    UNQUOTED_EDGE_LABEL_WITH_PARENTHESES,
    (_match, label: string) => `|"${label}"|`,
  );
