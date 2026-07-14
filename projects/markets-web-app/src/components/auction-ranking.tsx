export function AuctionRanking({
  allocatedQuantity,
  price,
}: Readonly<{ allocatedQuantity: number; price: number }>) {
  return (
    <section aria-labelledby="ranking-heading" className="sub-panel">
      <h2 id="ranking-heading">現在の公開状況</h2>
      <p>暫定割当数量: {allocatedQuantity}</p>
      <p>公開価格: {price}</p>
    </section>
  );
}
