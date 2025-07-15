import { faker } from "@faker-js/faker/locale/ja";
import { ContributionType, PrismaClient, TaskStatus } from "@prisma/client";

import type { SeedUser } from "./types";
import { CATEGORY_DELIVERY_METHODS, DELIVERY_METHODS, PRESERVED_USER_IDS, SEED_CONFIG } from "./config";

const prisma = new PrismaClient();

/**
 * タスクを生成する関数
 * @param count 生成するタスク数
 * @param groupMemberships グループメンバーシップの配列
 * @param users ユーザーの配列（評価者として使用）
 * @returns 生成されたタスクの配列
 */
export async function createTasks(
  count: number,
  groupMemberships: { userId: string; groupId: string }[],
  users: SeedUser[],
) {
  const tasks = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);
  const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));
  const otherUsers = users.filter((user) => !preservedUserIds.has(user.id)); // 追加: 保持ユーザー以外のリスト
  // TaskStatusの完了系ステータスリスト
  const completedStatuses: TaskStatus[] = [
    TaskStatus.TASK_COMPLETED,
    TaskStatus.FIXED_EVALUATED,
    TaskStatus.POINTS_AWARDED,
  ];
  // タスクが完了ステータスになる確率
  // const TASK_COMPLETED_PROBABILITY = 0.3; // SEED_CONFIGから取得するように変更

  for (let i = 0; i < count; i++) {
    // ランダムにグループを選択 (メンバーシップ情報からグループIDを取得)
    if (groupMemberships.length === 0) {
      console.warn("グループメンバーシップが存在しないため、タスクを作成できません。");
      continue; // メンバーシップがない場合はスキップ
    }

    const randomMembership = faker.helpers.arrayElement(groupMemberships);
    let groupId = randomMembership.groupId; // groupId を let で宣言
    let creator: SeedUser;

    // タスク作成者の決定:
    // 1. 最初の数件 (SEED_CONFIG.PRESERVED_USER_CREATE_TASK_INITIAL_COUNT まで) は保持ユーザーが順番に作成者になる
    if (i < SEED_CONFIG.PRESERVED_USER_CREATE_TASK_INITIAL_COUNT && preservedUsers.length > 0) {
      creator = preservedUsers[i % preservedUsers.length];
      // 作成者が選択したグループのメンバーであることを確認（そうでなければ別のグループを選ぶ）
      let attempts = 0;
      let creatorMembership = groupMemberships.find((m) => m.userId === creator.id && m.groupId === groupId);
      while (!creatorMembership && attempts < 10 && groupMemberships.length > 1) {
        const anotherMembership = faker.helpers.arrayElement(groupMemberships.filter((m) => m.groupId !== groupId));
        groupId = anotherMembership.groupId; // 再代入
        creatorMembership = groupMemberships.find((m) => m.userId === creator.id && m.groupId === groupId);
        attempts++;
      }
      // それでも見つからない場合は、ランダムなグループを選ぶ
      if (!creatorMembership) {
        const creatorGroups = groupMemberships.filter((m) => m.userId === creator.id);
        if (creatorGroups.length > 0) {
          groupId = faker.helpers.arrayElement(creatorGroups).groupId; // 再代入
        } else {
          // 保持ユーザーがいずれのグループにも属していない場合（通常ありえない）
          console.warn(`保持ユーザー ${creator.id} がどのグループにも属していません。ランダムなグループを選択します。`);
          groupId = faker.helpers.arrayElement(groupMemberships).groupId; // 再代入
        }
      }
    } else {
      // 2. それ以降は、選択されたグループのメンバーからランダムに作成者を選ぶ
      const potentialCreatorsInGroup = users.filter((u) =>
        groupMemberships.some((m) => m.groupId === groupId && m.userId === u.id),
      );
      if (potentialCreatorsInGroup.length > 0) {
        // グループメンバーの中から、保持ユーザーを優先的に選ぶ確率 (例: 30%)
        const PRESERVED_CREATOR_PROBABILITY = 0.3;
        const preservedCreatorsInGroup = potentialCreatorsInGroup.filter((u) => preservedUserIds.has(u.id));
        if (preservedCreatorsInGroup.length > 0 && faker.datatype.boolean(PRESERVED_CREATOR_PROBABILITY)) {
          creator = faker.helpers.arrayElement(preservedCreatorsInGroup);
        } else {
          // 保持ユーザーを選ばない場合、または保持ユーザーがいない場合は、他のメンバーからランダムに選ぶ
          const otherCreatorsInGroup = potentialCreatorsInGroup.filter((u) => !preservedUserIds.has(u.id));
          creator = faker.helpers.arrayElement(
            otherCreatorsInGroup.length > 0 ? otherCreatorsInGroup : potentialCreatorsInGroup,
          ); // 他のメンバーがいなければ保持ユーザー含む全体から
        }
      } else {
        // グループにメンバーがいない場合（通常ありえない）、全ユーザーからランダムに選ぶ
        console.warn(`グループ ${groupId} にメンバーが存在しません。全ユーザーからタスク作成者を選択します。`);
        creator = faker.helpers.arrayElement(users);
      }
    }

    // タスクの詳細を生成
    const taskTitle = faker.company.catchPhrase();
    // contributionTypeとcategoryを先に決定
    const isReward = faker.datatype.boolean(SEED_CONFIG.TASK_REWARD_PROBABILITY);
    const contributionType = isReward ? ContributionType.REWARD : ContributionType.NON_REWARD;
    const category = faker.helpers.arrayElement(SEED_CONFIG.TASK_CATEGORIES);

    let taskStatus: TaskStatus;
    if (contributionType === ContributionType.REWARD) {
      // オークション対象となる可能性のあるタスクは、初期ステータスをPENDINGに固定
      // オークションの状況に応じて後で POINTS_DEPOSITED などに変わる
      taskStatus = TaskStatus.PENDING;
    } else {
      // 報酬なしタスクは既存のロジックでステータス決定
      taskStatus = TaskStatus.PENDING; // デフォルトはPENDING
      if (faker.datatype.boolean(SEED_CONFIG.TASK_COMPLETED_PROBABILITY)) {
        taskStatus = faker.helpers.arrayElement(completedStatuses);
      }
    }

    // 評価者と評価ロジック (SEED_CONFIGの確率で設定)
    const hasEvaluator = faker.datatype.boolean(SEED_CONFIG.TASK_EVALUATOR_PROBABILITY);
    // 評価者を選択: 保持ユーザーを優先する (例: 20%の確率で保持ユーザーから選ぶ)
    const PRESERVED_EVALUATOR_PROBABILITY = 0.2;
    let evaluatorUser = null;
    if (hasEvaluator) {
      if (preservedUsers.length > 0 && faker.datatype.boolean(PRESERVED_EVALUATOR_PROBABILITY)) {
        evaluatorUser = faker.helpers.arrayElement(preservedUsers);
      } else {
        evaluatorUser = faker.helpers.arrayElement(otherUsers.length > 0 ? otherUsers : users); // 他のユーザーがいなければ全体から
      }
    }
    const fixedEvaluatorId = evaluatorUser?.id ?? null;
    const fixedEvaluationLogic = hasEvaluator ? faker.lorem.paragraph(1) : null;

    // 固定貢献ポイント (1-100)
    const fixedPoints = faker.number.int({ min: 1, max: 100 });

    // 証拠・結果・補足情報を生成 (SEED_CONFIGの確率で設定)
    const hasInfo = faker.datatype.boolean(SEED_CONFIG.TASK_INFO_PROBABILITY);
    let info = null;
    if (hasInfo) {
      const infoType = faker.helpers.arrayElement(["pullrequest", "achievement", "explanation"]);
      switch (infoType) {
        case "pullrequest":
          const repoName = faker.helpers.arrayElement(["project-x", "web-app", "api-service", "ui-components", "docs"]);
          const orgName = faker.helpers.arrayElement(["acme", "company", "team", "dev-group", "open-source"]);
          const prNumber = faker.number.int({ min: 1, max: 999 });
          info = `プルリクエスト: https://github.com/${orgName}/${repoName}/pull/${prNumber}`;
          break;
        case "achievement":
          const metric = faker.helpers.arrayElement([
            "パフォーマンス",
            "ユーザー数",
            "処理速度",
            "コード品質",
            "テストカバレッジ",
          ]);
          const improvement = faker.number.int({ min: 5, max: 95 });
          info = `${metric}が${improvement}%向上しました。詳細: ${faker.internet.url()}`;
          break;
        case "explanation":
          info = faker.lorem.paragraph(2);
          break;
      }
    }

    // TaskReporterとTaskExecutorの準備
    const reportersCount = faker.number.int({ min: SEED_CONFIG.TASK_REPORTER_MIN, max: SEED_CONFIG.TASK_REPORTER_MAX });
    const executorsCount = faker.number.int({ min: SEED_CONFIG.TASK_EXECUTOR_MIN, max: SEED_CONFIG.TASK_EXECUTOR_MAX });

    // --- getParticipants 関数の定義 (createTasks 内に移動) ---
    const getParticipants = (
      participantCount: number,
      includePreservedProbability: number,
    ): { name: string | null; userId?: string | null }[] => {
      const participants: { name: string | null; userId?: string | null }[] = [];
      const assignedUserIds = new Set<string>(); // 重複割り当てを防ぐ

      // 参加候補者: 作成者自身は除外
      const potentialParticipantUsers = users.filter((u) => u.id !== creator.id);
      const potentialPreserved = potentialParticipantUsers.filter((u) => preservedUserIds.has(u.id));
      const potentialOthers = potentialParticipantUsers.filter((u) => !preservedUserIds.has(u.id));

      // 参加者を追加
      for (let j = 0; j < participantCount; j++) {
        let participantUser: SeedUser | null = null;
        let participantName: string | null = null;

        // まだ割り当てられていない候補者のリスト
        const availablePreserved = potentialPreserved.filter((p) => !assignedUserIds.has(p.id));
        const availableOthers = potentialOthers.filter((o) => !assignedUserIds.has(o.id));
        const availableAll = potentialParticipantUsers.filter((u) => !assignedUserIds.has(u.id));

        // 1. 保持ユーザーを確率的に選択
        if (availablePreserved.length > 0 && faker.datatype.boolean(includePreservedProbability)) {
          participantUser = faker.helpers.arrayElement(availablePreserved);
        }

        // 2. 保持ユーザーを選ばなかった場合、または該当者がいない場合
        if (!participantUser) {
          // 登録ユーザーを70%の確率で選択
          const isRegisteredUser = faker.datatype.boolean(0.7);
          if (isRegisteredUser && availableOthers.length > 0) {
            participantUser = faker.helpers.arrayElement(availableOthers);
          } else if (isRegisteredUser && availableAll.length > 0) {
            // 他のユーザー候補がいないが、全体でまだ割り当てられていない候補者がいる場合
            participantUser = faker.helpers.arrayElement(availableAll);
          }
        }

        // 3. 登録ユーザーを選ばなかった場合、または候補がいなかった場合
        if (!participantUser && !faker.datatype.boolean(0.7)) {
          // 登録ユーザーを選ばなかった場合のみ非登録ユーザーを追加
          participantName = faker.person.fullName();
          participants.push({ name: participantName });
        } else if (participantUser) {
          // 登録ユーザーを割り当て
          participantName = participantUser.name;
          participants.push({ name: participantName, userId: participantUser.id });
          assignedUserIds.add(participantUser.id); // 割り当て済みセットに追加
        } else if (j === participantCount - 1 && participants.length === 0) {
          // ループの最後で、まだ誰も追加されておらず、非登録も選ばれなかった場合、
          // 最後の手段として利用可能な登録ユーザーを追加 (または非登録ユーザー)
          if (availableAll.length > 0) {
            participantUser = faker.helpers.arrayElement(availableAll);
            participantName = participantUser.name;
            participants.push({ name: participantName, userId: participantUser.id });
            assignedUserIds.add(participantUser.id);
          } else {
            participantName = faker.person.fullName();
            participants.push({ name: participantName });
          }
        }
      }

      // 参加者が一人も割り当てられなかった場合は作成者を参加者とする
      if (participants.length === 0 && creator) {
        participants.push({
          name: creator.name,
          userId: creator.id,
        });
      }

      return participants;
    };
    // --- getParticipants 関数の定義ここまで ---

    // 報告者と実行者を選択 (保持ユーザーが含まれる確率をそれぞれ設定)
    // const PRESERVED_REPORTER_PROBABILITY = 0.4; // SEED_CONFIGから取得するように変更
    // const PRESERVED_EXECUTOR_PROBABILITY = 0.4; // SEED_CONFIGから取得するように変更
    const reporters = getParticipants(reportersCount, SEED_CONFIG.PRESERVED_USER_AS_TASK_REPORTER_PROBABILITY);
    const executors = getParticipants(executorsCount, SEED_CONFIG.PRESERVED_USER_AS_TASK_EXECUTOR_PROBABILITY);

    // 出品タイプの場合は提供方法を設定
    let deliveryMethod = null;
    if (contributionType === ContributionType.REWARD) {
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] || DELIVERY_METHODS; // category はループの先頭で決定済み
      deliveryMethod = faker.helpers.arrayElement(categoryMethods);
    }

    // 固定提出者を選択: 保持ユーザーを優先する (SEED_CONFIGの確率で保持ユーザーから選ぶ)
    let fixedSubmitterUser = null;
    if (faker.datatype.boolean(SEED_CONFIG.TASK_FIXED_SUBMITTER_PROBABILITY)) {
      // const PRESERVED_SUBMITTER_PROBABILITY = 0.2; // SEED_CONFIGから取得するように変更
      if (
        preservedUsers.length > 0 &&
        faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_TASK_SUBMITTER_PROBABILITY)
      ) {
        fixedSubmitterUser = faker.helpers.arrayElement(preservedUsers);
      } else {
        fixedSubmitterUser = faker.helpers.arrayElement(otherUsers.length > 0 ? otherUsers : users); // 他のユーザーがいなければ全体から
      }
    }
    const userFixedSubmitterId = fixedSubmitterUser?.id ?? null;

    // タスク作成
    const task = await prisma.task.create({
      data: {
        task: taskTitle,
        detail: faker.lorem.paragraph(),
        reference: faker.datatype.boolean(SEED_CONFIG.TASK_REFERENCE_PROBABILITY) ? faker.internet.url() : null,
        imageUrl: faker.datatype.boolean(SEED_CONFIG.TASK_IMAGE_URL_PROBABILITY) ? faker.image.urlPicsumPhotos() : null,
        category, // ループの先頭で決定した category を使用
        status: taskStatus,
        fixedContributionPoint: fixedPoints,
        fixedEvaluatorId: fixedEvaluatorId,
        fixedEvaluationLogic,
        fixedEvaluationDate: hasEvaluator ? faker.date.recent() : null,
        info,
        contributionType, // ループの先頭で決定した contributionType を使用
        deliveryMethod,
        creatorId: creator.id,
        userFixedSubmitterId, // 修正: 選択した固定提出者を設定
        groupId,
        reporters: {
          create: reporters,
        },
        executors: {
          create: executors,
        },
      },
    });

    tasks.push(task);
  }

  console.log(`${tasks.length}件のタスクを作成しました`);
  return tasks;
}
