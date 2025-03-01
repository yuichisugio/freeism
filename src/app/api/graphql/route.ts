// GraphQLクライアント。クライアントからアクセスするときに使用するが、Next.jsではサーバーコンポーネントから普通にアクセスできるので使用場面が少なさそう
import { gql } from "@apollo/client/core";
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { type DocumentNode, type GraphQLResolveInfo } from "graphql";

// 型定義
type ResolverContext = Record<string, never>;

type QueryResolvers = {
  hello: (parent: unknown, args: unknown, context: ResolverContext, info: GraphQLResolveInfo) => string;
};

// GraphQLスキーマの定義
const typeDefs = gql`
  type Query {
    hello: String!
  }
` as unknown as DocumentNode;

// リゾルバーの定義
const resolvers = {
  Query: {
    hello: (_: unknown, __: unknown, ___: ResolverContext): string => "Hello World!",
  },
} satisfies {
  Query: QueryResolvers;
};

// Apollo Serverのインスタンスを作成
const server = new ApolloServer<ResolverContext>({
  typeDefs,
  resolvers,
});

// Next.js API Routeハンドラーの作成
const handler = startServerAndCreateNextHandler(server);

// GETとPOSTリクエストを処理
export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
