/**
 * モジュール宣言ファイル
 * TypeScriptコンパイラーがモジュールを見つけられない場合に使用
 */

// クライアントコンポーネントの型宣言
declare module "@/components/auction/detail/AuctionDetail" {
  import { type Auction } from "@/types/auction";

  export type AuctionDetailProps = {
    auction: Auction;
    isOwnAuction: boolean;
  };

  export const AuctionDetail: React.FC<AuctionDetailProps>;
}

declare module "@/components/auction/detail/BidForm" {
  import { type Auction } from "@/types/auction";

  export type BidFormProps = {
    auction: Auction;
    onCancel: () => void;
  };

  export const BidForm: React.FC<BidFormProps>;
}

declare module "@/components/auction/detail/CountdownDisplay" {
  import { type CountdownState } from "@/hooks/auction/bid/use-countdown";

  export type CountdownDisplayProps = {
    countdownState: CountdownState;
    formattedCountdown: string;
  };

  export const CountdownDisplay: React.FC<CountdownDisplayProps>;
}

// UIコンポーネントの型宣言
declare module "@/components/ui/table" {
  export const Table: React.FC<React.ComponentProps<"table">>;
  export const TableHeader: React.FC<React.ComponentProps<"thead">>;
  export const TableBody: React.FC<React.ComponentProps<"tbody">>;
  export const TableFooter: React.FC<React.ComponentProps<"tfoot">>;
  export const TableRow: React.FC<React.ComponentProps<"tr">>;
  export const TableHead: React.FC<React.ComponentProps<"th">>;
  export const TableCell: React.FC<React.ComponentProps<"td">>;
  export const TableCaption: React.FC<React.ComponentProps<"caption">>;
}

declare module "@/components/ui/avatar" {
  export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src: string }>;
  export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLDivElement>>;
}

declare module "@/components/ui/skeleton" {
  export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>>;
}
