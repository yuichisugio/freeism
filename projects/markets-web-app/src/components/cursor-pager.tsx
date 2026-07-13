export function CursorPager({
  disabled,
  onNext,
}: Readonly<{ disabled: boolean; onNext: () => void }>) {
  return (
    <button disabled={disabled} onClick={onNext} type="button">
      次のページ
    </button>
  );
}
