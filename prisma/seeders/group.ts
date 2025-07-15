import { faker } from "@faker-js/faker/locale/ja";
import { PrismaClient } from "@prisma/client";

import type { EvaluationMethod, SeedGroup, SeedUser } from "./types";
import { PRESERVED_USER_IDS, SEED_CONFIG } from "./config";

const prisma = new PrismaClient();

export async function createGroups(users: SeedUser[]) {
  const groups = [];
  const evaluationMethods: EvaluationMethod[] = [
    "360度評価",
    "相互評価",
    "目標達成度",
    "KPI評価",
    "コンピテンシー評価",
  ];

  // グループの数はSEED_CONFIGから取得
  const groupsCount = SEED_CONFIG.GROUPS_COUNT;

  // 保持されたユーザーとそれ以外のユーザーに分ける
  const preservedUsers = users.filter((user) => PRESERVED_USER_IDS.includes(user.id));
  const otherUsers = users.filter((user) => !PRESERVED_USER_IDS.includes(user.id));

  // 作成者リストを作成 (保持ユーザーを優先し、不足分は他のユーザーからランダムに補充)
  const creators = [
    ...preservedUsers,
    ...faker.helpers.shuffle(otherUsers).slice(0, Math.max(0, groupsCount - preservedUsers.length)),
  ].slice(0, groupsCount); // グループ数に合わせて作成者数を調整

  // 作成者が不足している場合は警告（通常は発生しないはず）
  if (creators.length < groupsCount) {
    console.warn(
      `グループ作成者数が不足しています (${creators.length}/${groupsCount})。一部グループは他のユーザーによって作成されます。`,
    );
    // 不足分を他のユーザーから補充（重複しないように）
    const remainingCreatorsNeeded = groupsCount - creators.length;
    const existingCreatorIds = new Set(creators.map((c) => c.id));
    const additionalCreators = faker.helpers
      .shuffle(otherUsers.filter((u) => !existingCreatorIds.has(u.id)))
      .slice(0, remainingCreatorsNeeded);
    creators.push(...additionalCreators);
  }

  for (let i = 0; i < groupsCount; i++) {
    // 作成者を選択 (リストから順番に割り当て)
    // リストがグループ数より少ない場合（警告が出た場合）は循環させるか、ランダム選択にする
    const creatorUser = creators.length >= groupsCount ? creators[i] : faker.helpers.arrayElement(creators);

    // ポイント預け入れ期間を生成（7〜90日の範囲）
    const depositPeriod = faker.number.int({ min: 7, max: 90 });

    const group = await prisma.group.create({
      data: {
        name: `${faker.company.name()} グループ ${i + 1}`,
        goal: faker.company.catchPhrase(),
        evaluationMethod: faker.helpers.arrayElement(evaluationMethods),
        maxParticipants: faker.number.int({
          min: SEED_CONFIG.MIN_MEMBERS_PER_GROUP,
          max: SEED_CONFIG.MAX_MEMBERS_PER_GROUP * 2,
        }),
        depositPeriod: depositPeriod,
        createdBy: creatorUser.id,
        isBlackList: {},
      },
    });
    groups.push(group);
  }

  console.log(`${groups.length}件のグループを作成しました`);

  // グループメンバーシップを作成
  const groupMemberships = await createGroupMemberships(
    groups,
    users,
    SEED_CONFIG.MIN_MEMBERS_PER_GROUP,
    SEED_CONFIG.MAX_MEMBERS_PER_GROUP,
  );

  return { groups, groupMemberships };
}

export async function createGroupMemberships(
  groups: SeedGroup[],
  users: SeedUser[],
  minMembersPerGroup: number,
  maxMembersPerGroup: number,
) {
  const memberships = [];
  const membershipSet = new Set<string>(); // 重複チェック用
  const preservedUserIds = new Set(PRESERVED_USER_IDS);
  const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));

  // 各グループにメンバーを追加
  for (const group of groups) {
    const usersInGroup: SeedUser[] = []; // このグループに参加するユーザー

    // 1. グループ作成者は必ずメンバーにする
    const creator = users.find((u) => u.id === group.createdBy);
    if (creator) {
      usersInGroup.push(creator);
    } else {
      // グループ作成者が見つからない場合（通常ありえないが念のため）
      console.warn(`グループ ${group.id} の作成者 ${group.createdBy} がユーザーリストに見つかりません。`);
      // ランダムなユーザーを一人追加しておく
      if (users.length > 0) {
        usersInGroup.push(faker.helpers.arrayElement(users));
      }
    }

    // 2. 保持ユーザーを優先的にメンバーに追加する (SEED_CONFIGの確率で追加)
    for (const preservedUser of preservedUsers) {
      // 既にグループ作成者として追加されている場合はスキップ
      if (usersInGroup.some((u) => u.id === preservedUser.id)) continue;
      // SEED_CONFIG の確率で参加させる
      if (faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_JOIN_GROUP_PROBABILITY)) {
        usersInGroup.push(preservedUser);
      }
    }

    // 3. グループに追加する最終的なメンバー数を決定
    const numMembers = faker.number.int({
      min: Math.max(minMembersPerGroup, usersInGroup.length), // 最小メンバー数と既に追加済みの人数を考慮
      max: Math.min(maxMembersPerGroup, users.length, group.maxParticipants), // 最大メンバー数、全ユーザー数、グループの最大参加人数を考慮
    });

    // 4. 不足分のメンバーをランダムに選択（既に追加済みと作成者を除く）
    const remainingCount = numMembers - usersInGroup.length;
    if (remainingCount > 0) {
      const potentialMembers = users.filter((user) => !usersInGroup.some((u) => u.id === user.id));
      // シャッフルして人数分だけ追加
      const additionalMembers = faker.helpers.shuffle(potentialMembers).slice(0, remainingCount);
      usersInGroup.push(...additionalMembers);
    }

    // 5. メンバーシップを作成
    for (const user of usersInGroup) {
      const membershipKey = `${user.id}-${group.id}`;

      // 重複チェック
      if (!membershipSet.has(membershipKey)) {
        membershipSet.add(membershipKey);

        // グループ作成者はグループオーナーとして設定
        const isGroupOwner = group.createdBy === user.id;

        const membership = await prisma.groupMembership.create({
          data: {
            userId: user.id,
            groupId: group.id,
            joinedAt: faker.date.recent({ days: 30 }), // 過去30日以内のランダムな日時
            isGroupOwner,
          },
        });
        memberships.push(membership);
      }
    }
  }

  console.log(`${memberships.length}件のグループメンバーシップを作成しました`);
  return memberships;
}

export async function createGroupPoints() {
  const pointsList = [];

  // 各グループメンバーシップに基づいてポイントを作成
  const memberships = await prisma.groupMembership.findMany({
    include: {
      user: true,
      group: true,
    },
  });

  for (const membership of memberships) {
    const basePoints = faker.number.int({
      min: SEED_CONFIG.GROUP_POINTS_INITIAL_MIN,
      max: SEED_CONFIG.GROUP_POINTS_INITIAL_MAX,
    });

    const points = await prisma.groupPoint.create({
      data: {
        userId: membership.userId,
        groupId: membership.groupId,
        balance: basePoints,
        fixedTotalPoints: basePoints,
      },
    });
    pointsList.push(points);
  }

  console.log(`${pointsList.length}件のグループポイントを作成しました`);
  return pointsList;
}
