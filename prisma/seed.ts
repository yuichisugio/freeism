// import { PrismaClient } from '@prisma/client'
// import { prisma } from 'src/lib'
// import * as argon2 from "argon2";

// const prisma = new PrismaClient()

// async function main() {
//   // データベースをクリーンアップ
//   await prisma.post.deleteMany()
//   await prisma.user.deleteMany()

//   // ユーザーデータの作成
//   const user1 = await prisma.user.create({
//     data: {
//       name: 'John Doe',
//       email: 'john@example.com',
//       // パスワードをハッシュ化して保存
//       hashedPassword: await hash('password123', 12),
//     },
//   })

//   const user2 = await prisma.user.create({
//     data: {
//       name: 'Jane Smith',
//       email: 'jane@example.com',
//       hashedPassword: await hash('password456', 12),
//     },
//   })

//   // 投稿データの作成
//   await prisma.post.create({
//     data: {
//       title: 'First Post',
//       content: 'This is my first post content.',
//       published: true,
//       authorId: user1.id,
//     },
//   })

//   await prisma.post.create({
//     data: {
//       title: 'Second Post',
//       content: 'This is another post content.',
//       published: true,
//       authorId: user2.id,
//     },
//   })

//   console.log('Database has been seeded.')
// }

// main()
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prisma.$disconnect()
//   })
