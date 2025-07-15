import { faker } from "@faker-js/faker/locale/ja";
import { PrismaClient, TaskStatus } from "@prisma/client";

import type { SeedTask, SeedUser } from "./types";
import { PRESERVED_USER_IDS, SEED_CONFIG } from "./config";

/**
 * 分析データを生成する関数
 * @param tasks タスクの配列
 * @param users ユーザーの配列（評価者として使用）
 * @returns 生成された分析データの配列
 */
export async function createAnalytics(tasks: SeedTask[], users: SeedUser[]) {
  const prisma = new PrismaClient();
  const analytics = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  // 完了したタスクのみ分析対象とする
  const completedStatuses: TaskStatus[] = [
    TaskStatus.TASK_COMPLETED,
    TaskStatus.FIXED_EVALUATED,
    TaskStatus.POINTS_AWARDED,
  ];
  const completedTasks = tasks.filter((task) => completedStatuses.includes(task.status as TaskStatus));

  console.log(`${completedTasks.length}件の完了タスクから分析データを作成します`);

  for (const task of completedTasks) {
    const evaluationsCount = faker.number.int({
      min: SEED_CONFIG.ANALYTICS_PER_COMPLETED_TASK_MIN,
      max: SEED_CONFIG.ANALYTICS_PER_COMPLETED_TASK_MAX,
    });

    for (let i = 0; i < evaluationsCount; i++) {
      // 評価者を選択（タスク作成者以外、保持ユーザーを優先的に選択する確率）
      const potentialEvaluators = users.filter((user) => user.id !== task.creatorId);
      const preservedEvaluators = potentialEvaluators.filter((u) => preservedUserIds.has(u.id));
      const otherEvaluators = potentialEvaluators.filter((u) => !preservedUserIds.has(u.id));

      // const PRESERVED_ANALYTICS_EVALUATOR_PROBABILITY = 0.3; // SEED_CONFIGから取得するように変更
      let evaluatorUser: SeedUser | null = null;

      if (potentialEvaluators.length > 0) {
        if (
          preservedEvaluators.length > 0 &&
          faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_ANALYTICS_EVALUATOR_PROBABILITY)
        ) {
          evaluatorUser = faker.helpers.arrayElement(preservedEvaluators);
        } else {
          evaluatorUser = faker.helpers.arrayElement(
            otherEvaluators.length > 0 ? otherEvaluators : potentialEvaluators,
          );
        }
      } else {
        // タスク作成者しかいない場合（通常ありえない）
        console.warn(`タスク ${task.id} の評価者候補がいません。`);
        continue; // この分析データは作成しない
      }

      if (!evaluatorUser) continue; // 評価者が選択されなかった場合
      const evaluatorId = evaluatorUser.id;

      const basePoint = task.fixedContributionPoint ?? faker.number.int({ min: 10, max: 50 });
      const variation = faker.number.int({ min: -5, max: 10 });
      const contributionPoint = Math.max(1, Math.min(100, basePoint + variation));

      const evaluationReasons = [
        "期限内に質の高い成果物を提出した",
        "チームメンバーとの協力が優れていた",
        "追加の作業を自主的に行った",
        "問題解決に創造的なアプローチを示した",
        "技術的に難しい課題を克服した",
        "リソースを効率的に活用した",
        "ドキュメントが詳細で分かりやすかった",
        "フィードバックに基づいて迅速に改善した",
      ];
      const selectedReasons = faker.helpers.arrayElements(evaluationReasons, faker.number.int({ min: 2, max: 3 }));
      const evaluationLogic = selectedReasons.join("。") + "。";

      const analytic = await prisma.analytics.create({
        data: {
          taskId: task.id,
          groupId: task.groupId,
          evaluator: evaluatorId, // evaluatorId を使用
          contributionPoint,
          evaluationLogic,
        },
      });
      analytics.push(analytic);
    }
  }

  console.log(`${analytics.length}件の分析データを作成しました`);
  return analytics;
}
